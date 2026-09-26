import type {
  BrandStat,
  Hotspot,
  HotspotsPayload,
  NewsItem,
  SourceId,
  SourceRunResult,
  TopicStat,
  Trend,
} from "@/lib/types";
import {
  extractCorpusKeywords,
  extractEntities,
  isRankedTitle,
  keywordsInTitle,
  titleSimilarity,
} from "./extract";

export const WINDOW_HOURS = 24 * 7;

/** 上一轮快照，用于计算趋势 */
export interface PreviousSnapshot {
  hotspots: Array<{ id: string; score: number; itemIds: string[] }>;
}

interface Enriched {
  item: NewsItem;
  brands: string[];
  models: string[];
  topics: string[];
  keywords: string[];
  /** 品牌 + 车型 + 热词，用于聚类的强特征 */
  strong: string[];
  /** 汇总类条目（晨报/快讯合集），不参与聚类，避免把多个事件串成一团 */
  isDigest: boolean;
  /** 榜单类条目，标题是模板，不能用标题相似度兜底合并 */
  isRanked: boolean;
  ageHours: number;
}

/** 强特征权重：品牌/车型是最可靠的同事件信号，语料热词稍弱 */
const W_BRAND = 1.0;
const W_KEYWORD = 0.8;
/** 话题权重：具体话题（召回、价格战等）比泛话题（新车上市、销量）更能说明是同一事件 */
const SPECIFIC_TOPICS = new Set(["价格战", "召回", "出海", "政策", "资本经营", "智驾"]);
const W_TOPIC_SPECIFIC = 0.6;
const W_TOPIC_GENERIC = 0.2;

const DIGEST_RE = /(晨报|早报|日报|周报|快讯】|一周|盘点|汇总|速览|要闻|早知道)/;

function isDigestTitle(title: string): boolean {
  const separators = (title.match(/[；;]/g) ?? []).length;
  return separators >= 2 || DIGEST_RE.test(title);
}

function strongWeight(e: Enriched, f: string): number {
  return e.keywords.includes(f) && !e.brands.includes(f) && !e.models.includes(f) ? W_KEYWORD : W_BRAND;
}

function topicWeight(t: string): number {
  return SPECIFIC_TOPICS.has(t) ? W_TOPIC_SPECIFIC : W_TOPIC_GENERIC;
}

interface Cluster {
  members: Enriched[];
  strongCounts: Map<string, number>;
  topicCounts: Map<string, number>;
}

const MERGE_THRESHOLD = 1.5;
const TITLE_SIM_THRESHOLD = 0.32;

function weight(counts: Map<string, number>, size: number, key: string): number {
  return (counts.get(key) ?? 0) / size;
}

function similarity(e: Enriched, c: Cluster): number {
  const size = c.members.length;
  let strong = 0;
  let sharedStrong = 0;
  for (const f of e.strong) {
    const w = weight(c.strongCounts, size, f);
    if (w > 0) {
      sharedStrong++;
      strong += w * strongWeight(e, f);
    }
  }
  let topic = 0;
  for (const t of e.topics) topic += weight(c.topicCounts, size, t) * topicWeight(t);
  if (sharedStrong === 0) {
    // 没有共同实体时，只有标题措辞高度相似才合并（榜单模板标题除外）
    if (e.isRanked) return 0;
    const best = Math.max(
      ...c.members.map((m) => (m.isRanked ? 0 : titleSimilarity(m.item.title, e.item.title))),
    );
    return best >= TITLE_SIM_THRESHOLD ? MERGE_THRESHOLD + best : 0;
  }
  return strong + topic;
}

function addToCluster(c: Cluster, e: Enriched) {
  c.members.push(e);
  for (const f of e.strong) c.strongCounts.set(f, (c.strongCounts.get(f) ?? 0) + 1);
  for (const t of e.topics) c.topicCounts.set(t, (c.topicCounts.get(t) ?? 0) + 1);
}

function clusterItems(enriched: Enriched[]): Cluster[] {
  const clusters: Cluster[] = [];
  // 先处理实体丰富、时间新的条目，让它们成为聚类种子
  const ordered = enriched
    .filter((e) => !e.isDigest)
    .sort((a, b) => b.strong.length - a.strong.length || a.ageHours - b.ageHours);
  for (const e of ordered) {
    let best: Cluster | null = null;
    let bestSim = 0;
    for (const c of clusters) {
      const sim = similarity(e, c);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    if (best && bestSim >= MERGE_THRESHOLD) {
      addToCluster(best, e);
    } else {
      const c: Cluster = { members: [], strongCounts: new Map(), topicCounts: new Map() };
      addToCluster(c, e);
      clusters.push(c);
    }
  }
  return clusters;
}

function topKeys(counts: Map<string, number>, n: number, exclude: Set<string> = new Set()): string[] {
  return Array.from(counts.entries())
    .filter(([k]) => !exclude.has(k))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .slice(0, n)
    .map(([k]) => k);
}

function pickRepresentative(c: Cluster): Enriched {
  const size = c.members.length;
  const scored = c.members.map((m) => {
    let cover = 0;
    for (const f of m.strong) cover += weight(c.strongCounts, size, f);
    const len = m.item.title.length;
    const lengthPenalty = len < 10 ? 0.5 : len < 14 ? 0.8 : len > 50 ? 0.8 : 1;
    const hotlistPenalty = m.item.sourceId === "baidu-hot" || m.item.sourceId === "weibo-hot" || m.item.sourceId === "dongchedi" ? 0.4 : 1;
    return { m, s: cover * lengthPenalty * hotlistPenalty - m.ageHours / 1000 };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].m;
}

function clusterKey(c: Cluster, brands: string[]): string {
  const strong = topKeys(c.strongCounts, 3);
  const base = strong.length > 0 ? strong : brands;
  return `h-${[...base].sort().join("-").replace(/\s+/g, "")}`.slice(0, 80);
}

function computeTrend(
  recent24: number,
  prior: number,
  score: number,
  prevScore: number | undefined,
): { trend: Trend; delta: number } {
  if (prevScore !== undefined) {
    const delta = Math.round(score - prevScore);
    if (Math.abs(delta) >= 5) return { trend: delta > 0 ? "up" : "down", delta };
  }
  if (recent24 >= 2 && recent24 > prior) return { trend: "up", delta: prevScore === undefined ? 0 : Math.round(score - prevScore) };
  if (recent24 === 0 && prior > 0) return { trend: "down", delta: prevScore === undefined ? 0 : Math.round(score - prevScore) };
  return { trend: "flat", delta: prevScore === undefined ? 0 : Math.round(score - prevScore) };
}

export function analyze(
  rawItems: NewsItem[],
  sources: SourceRunResult[],
  previous?: PreviousSnapshot,
  now = new Date(),
): HotspotsPayload {
  const cutoff = now.getTime() - WINDOW_HOURS * 3_600_000;
  const items = rawItems.filter((it) => {
    const t = new Date(it.publishedAt).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });

  const corpusKeywords = extractCorpusKeywords(items.map((i) => i.title));

  const enriched: Enriched[] = items.map((item) => {
    const ents = extractEntities(`${item.title} ${item.summary ?? ""}`);
    const keywords = keywordsInTitle(item.title, corpusKeywords);
    const strong = Array.from(new Set([...ents.brands, ...ents.models, ...keywords]));
    const ageHours = Math.max(0, (now.getTime() - new Date(item.publishedAt).getTime()) / 3_600_000);
    item.brands = ents.brands;
    item.topics = ents.topics;
    item.keywords = keywords;
    return {
      item,
      brands: ents.brands,
      models: ents.models,
      topics: ents.topics,
      keywords,
      strong,
      isDigest: isDigestTitle(item.title),
      isRanked: isRankedTitle(item.title),
      ageHours,
    };
  });

  const clusters = clusterItems(enriched);

  // 各信源热榜数值归一化（同信源内相对最大值）
  const maxHotBySource = new Map<SourceId, number>();
  for (const e of enriched) {
    if (e.item.hotValue) {
      maxHotBySource.set(e.item.sourceId, Math.max(maxHotBySource.get(e.item.sourceId) ?? 0, e.item.hotValue));
    }
  }

  const rawScores = clusters.map((c) => {
    const mentions = Math.log2(1 + c.members.length);
    const sourceSet = new Set(c.members.map((m) => m.item.sourceId));
    const sourcesN = sourceSet.size;
    let freshness = 0;
    let hot = 0;
    for (const m of c.members) {
      freshness += Math.exp(-m.ageHours / 24);
      if (m.item.hotValue) {
        hot += m.item.hotValue / (maxHotBySource.get(m.item.sourceId) ?? m.item.hotValue);
      }
    }
    return { c, mentions, sourcesN, freshness, hot };
  });

  const maxOf = (k: "mentions" | "sourcesN" | "freshness" | "hot") =>
    Math.max(1e-9, ...rawScores.map((r) => r[k]));
  const mMax = maxOf("mentions");
  const sMax = maxOf("sourcesN");
  const fMax = maxOf("freshness");
  const hMax = maxOf("hot");
  const hasHot = rawScores.some((r) => r.hot > 0);

  const prevByItem = new Map<string, number>();
  for (const h of previous?.hotspots ?? []) {
    for (const id of h.itemIds) prevByItem.set(id, h.score);
  }

  const hotspots: Hotspot[] = rawScores.map(({ c, mentions, sourcesN, freshness, hot }) => {
    const wHot = hasHot ? 0.1 : 0;
    const raw =
      (0.3 + (hasHot ? 0 : 0.05)) * (mentions / mMax) +
      (0.3 + (hasHot ? 0 : 0.05)) * (sourcesN / sMax) +
      0.3 * (freshness / fMax) +
      wHot * (hot / hMax);
    const score = Math.round(raw * 1000) / 10;

    const members = [...c.members].sort(
      (a, b) => new Date(b.item.publishedAt).getTime() - new Date(a.item.publishedAt).getTime(),
    );
    const rep = pickRepresentative(c);
    const brandCounts = new Map<string, number>();
    for (const m of c.members) for (const b of m.brands) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
    const brands = topKeys(brandCounts, 4);
    const topics = topKeys(c.topicCounts, 3);
    const keywords = topKeys(c.strongCounts, 5, new Set([...brands, ...c.members.flatMap((m) => m.brands)]));

    const recent24 = c.members.filter((m) => m.ageHours <= 24).length;
    const prior = c.members.filter((m) => m.ageHours > 24 && m.ageHours <= 72).length;
    const itemIds = c.members.map((m) => m.item.id);
    const prevScores = itemIds.map((id) => prevByItem.get(id)).filter((v): v is number => v !== undefined);
    const prevScore = prevScores.length > 0 ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length : undefined;
    const { trend, delta } = computeTrend(recent24, prior, score, prevScore);

    // 摘要优先取代表条目；其次取非榜单条目的摘要或标题，避免用“日均关注度 xxx”这类模板文案
    const others = members.filter((m) => m.item.id !== rep.item.id && !m.isRanked);
    const summaryCandidate =
      rep.item.summary ??
      others.find((m) => m.item.summary)?.item.summary ??
      others[0]?.item.title ??
      "";

    return {
      id: clusterKey(c, brands),
      title: rep.item.title,
      summary: summaryCandidate.length > 140 ? `${summaryCandidate.slice(0, 140)}…` : summaryCandidate,
      score,
      trend,
      trendDelta: delta,
      mentionCount: c.members.length,
      sourceCount: sourcesN,
      sourceIds: Array.from(new Set(members.map((m) => m.item.sourceId))),
      brands,
      topics,
      keywords,
      firstSeen: members[members.length - 1].item.publishedAt,
      lastSeen: members[0].item.publishedAt,
      recent24h: recent24,
      items: members.map((m) => m.item),
    };
  });

  // 热点事件：至少 2 次提及或跨 2 个信源；不足 8 个时用高分单条补足
  const multi = hotspots.filter((h) => h.mentionCount >= 2 || h.sourceCount >= 2);
  const singles = hotspots.filter((h) => !(h.mentionCount >= 2 || h.sourceCount >= 2));
  const ranked = [...multi, ...(multi.length < 8 ? singles.slice(0, 8 - multi.length) : [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  // 保证 id 唯一
  const seenIds = new Map<string, number>();
  for (const h of ranked) {
    const n = seenIds.get(h.id) ?? 0;
    seenIds.set(h.id, n + 1);
    if (n > 0) h.id = `${h.id}-${n + 1}`;
  }

  const topicCounts = new Map<string, number>();
  const topicHotspots = new Map<string, number>();
  let topicTotal = 0;
  for (const e of enriched) {
    for (const t of e.topics) {
      topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      topicTotal++;
    }
  }
  for (const h of ranked) for (const t of h.topics) topicHotspots.set(t, (topicHotspots.get(t) ?? 0) + 1);
  const topics: TopicStat[] = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({
      topic,
      count,
      share: topicTotal > 0 ? Math.round((count / topicTotal) * 1000) / 10 : 0,
      hotspotCount: topicHotspots.get(topic) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const brandAgg = new Map<string, { count: number; sources: Set<SourceId>; topics: Map<string, number> }>();
  for (const e of enriched) {
    for (const b of e.brands) {
      const agg = brandAgg.get(b) ?? { count: 0, sources: new Set<SourceId>(), topics: new Map<string, number>() };
      agg.count++;
      agg.sources.add(e.item.sourceId);
      for (const t of e.topics) agg.topics.set(t, (agg.topics.get(t) ?? 0) + 1);
      brandAgg.set(b, agg);
    }
  }
  const brandHotspots = new Map<string, number>();
  for (const h of ranked) for (const b of h.brands) brandHotspots.set(b, (brandHotspots.get(b) ?? 0) + 1);
  const brands: BrandStat[] = Array.from(brandAgg.entries())
    .map(([brand, agg]) => ({
      brand,
      count: agg.count,
      sourceCount: agg.sources.size,
      hotspotCount: brandHotspots.get(brand) ?? 0,
      topTopics: topKeys(agg.topics, 2),
    }))
    .sort((a, b) => b.count - a.count || b.sourceCount - a.sourceCount)
    .slice(0, 15);

  // 时间线只放资讯与热搜词，榜单模板条目（懂车帝榜/百度汽车榜）只参与热度与品牌统计
  const timeline = items
    .filter((it) => !isRankedTitle(it.title))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const items24h = enriched.filter((e) => e.ageHours <= 24).length;

  return {
    generatedAt: now.toISOString(),
    windowHours: WINDOW_HOURS,
    hotspots: ranked,
    topics,
    brands,
    timeline,
    sources,
    stats: {
      totalItems: items.length,
      hotspotCount: ranked.length,
      liveSources: sources.filter((s) => s.status === "live").length,
      mockSources: sources.filter((s) => s.status !== "live").length,
      items24h,
    },
  };
}
