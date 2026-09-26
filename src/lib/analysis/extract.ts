import { BRANDS, STOPWORDS, TOPICS } from "./dictionary";

export interface Extraction {
  brands: string[];
  /** 命中的车型名（已归一到词典写法） */
  models: string[];
  topics: string[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 短的字母数字型 token（如 M8、L6、YU7）需要边界匹配，避免误命中 */
function alnumBoundaryRe(token: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRe(token)}(?![A-Za-z0-9])`, "i");
}

function isAlnum(token: string): boolean {
  return /^[A-Za-z0-9 .+\-]+$/.test(token);
}

interface CompiledMatcher {
  token: string;
  re: RegExp | null;
}

interface CompiledBrand {
  name: string;
  matchers: CompiledMatcher[];
  models: CompiledMatcher[];
}

function compile(token: string): CompiledMatcher {
  return { token, re: isAlnum(token) ? alnumBoundaryRe(token) : null };
}

function hit(text: string, lower: string, m: CompiledMatcher): boolean {
  return m.re ? m.re.test(text) : lower.includes(m.token.toLowerCase());
}

const modelOwners = new Map<string, Set<string>>();
for (const b of BRANDS) {
  for (const m of b.models ?? []) {
    if (!modelOwners.has(m)) modelOwners.set(m, new Set());
    modelOwners.get(m)!.add(b.name);
  }
}

const COMPILED_BRANDS: CompiledBrand[] = BRANDS.map((b) => ({
  name: b.name,
  matchers: [b.name, ...b.aliases].map(compile),
  // 被多个品牌共用的车型代号（如 L6、X9）不用于归属判断
  models: (b.models ?? []).filter((m) => modelOwners.get(m)!.size === 1).map(compile),
}));

const COMPILED_TOPICS = TOPICS.map((t) => ({ name: t.name, matchers: t.keywords.map(compile) }));

export function extractEntities(text: string): Extraction {
  const lower = text.toLowerCase();
  const brands: string[] = [];
  const models: string[] = [];
  for (const b of COMPILED_BRANDS) {
    let matched = b.matchers.some((m) => hit(text, lower, m));
    const hitModels = b.models.filter((m) => hit(text, lower, m)).map((m) => m.token);
    if (hitModels.length > 0) {
      matched = true;
      models.push(...hitModels);
    }
    if (matched) brands.push(b.name);
  }
  const topics = COMPILED_TOPICS.filter((t) => t.matchers.some((m) => hit(text, lower, m))).map((t) => t.name);
  return { brands: Array.from(new Set(brands)), models: Array.from(new Set(models)), topics };
}

/** 榜单类条目（懂车帝榜、百度汽车热榜等） */
export function isRankedTitle(title: string): boolean {
  return /榜第\s*\d+\s*名/.test(title);
}

/** 去掉榜单类信源的模板前缀，避免模板词被当成热词 */
export function normalizeForKeywords(title: string): string {
  return title
    .replace(/^[^：:]{0,12}榜第\s*\d+\s*名[：:]\s*/, "")
    .replace(/^EV晨报\s*[|｜]\s*/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/[（(][^）)]*[）)]/g, " ");
}

const CJK_SEGMENT_RE = /[\u4e00-\u9fff]{2,}/g;

const ENTITY_TOKENS = new Set<string>();
for (const b of BRANDS) {
  ENTITY_TOKENS.add(b.name);
  b.aliases.forEach((a) => ENTITY_TOKENS.add(a));
  (b.models ?? []).forEach((m) => ENTITY_TOKENS.add(m));
}
for (const t of TOPICS) {
  t.keywords.forEach((k) => ENTITY_TOKENS.add(k));
}

/** 需要在切片前遮蔽的词：实体词与停用词，长词优先，避免 n-gram 跨越词边界 */
const MASK_TOKENS = Array.from(new Set([...ENTITY_TOKENS, ...STOPWORDS]))
  .filter((t) => t.length >= 2)
  .sort((a, b) => b.length - a.length);

function maskKnownTokens(text: string): string {
  let out = text;
  for (const tok of MASK_TOKENS) {
    if (out.includes(tok)) out = out.split(tok).join(" ");
  }
  return out;
}

/** 从单条标题中提取 2~4 字中文候选片段（已去除实体词与停用词） */
export function candidateGrams(title: string): Set<string> {
  const grams = new Set<string>();
  const text = maskKnownTokens(normalizeForKeywords(title));
  for (const seg of text.match(CJK_SEGMENT_RE) ?? []) {
    for (let n = 2; n <= Math.min(4, seg.length); n++) {
      for (let i = 0; i + n <= seg.length; i++) {
        const g = seg.slice(i, i + n);
        if (STOPWORDS.has(g)) continue;
        grams.add(g);
      }
    }
  }
  return grams;
}

/**
 * 基于语料统计的热词提取：
 * 二字片段需出现在 ≥3 条标题、三四字片段 ≥2 条，且不超过语料的 8%（过滤模板词），
 * 并去掉被更长且几乎同频的片段覆盖的短片段。
 */
export function extractCorpusKeywords(titles: string[]): Map<string, number> {
  const df = new Map<string, number>();
  const perTitle = titles.map(candidateGrams);
  for (const grams of perTitle) {
    for (const g of grams) df.set(g, (df.get(g) ?? 0) + 1);
  }
  const maxDf = Math.max(10, Math.floor(titles.length * 0.08));
  const kept = new Map<string, number>();
  for (const [g, n] of df) {
    const minDf = g.length === 2 ? 3 : 2;
    if (n < minDf || n > maxDf) continue;
    kept.set(g, n);
  }
  // 长片段优先：若“固态电池”与“固态”“态电池”同频，只保留最长的
  const sorted = Array.from(kept.entries()).sort((a, b) => b[0].length - a[0].length);
  const final = new Map<string, number>();
  for (const [g, n] of sorted) {
    let covered = false;
    for (const [longer, ln] of final) {
      if (longer.length > g.length && longer.includes(g) && n <= ln * 1.25) {
        covered = true;
        break;
      }
    }
    if (!covered) final.set(g, n);
  }
  return final;
}

export function keywordsInTitle(title: string, corpus: Map<string, number>): string[] {
  const text = maskKnownTokens(normalizeForKeywords(title));
  const hits = Array.from(corpus.keys()).filter((k) => text.includes(k));
  // 同样做长片段优先，避免“固态”与“固态电池”重复
  return hits.filter((k) => !hits.some((o) => o !== k && o.length > k.length && o.includes(k)));
}

/** 标题字符二元组 Jaccard 相似度，用于同一事件不同措辞的兜底合并 */
export function titleSimilarity(a: string, b: string): number {
  const bg = (s: string) => {
    const t = normalizeForKeywords(s).replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
    const set = new Set<string>();
    for (let i = 0; i + 2 <= t.length; i++) set.add(t.slice(i, i + 2).toLowerCase());
    return set;
  };
  const A = bg(a);
  const B = bg(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
