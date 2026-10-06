import type { NewsItem } from "@/lib/types";
import { cleanTitle, fetchJson, isAutoRelated, makeItemId, type SourceAdapter } from "./base";

interface WeiboBandEntry {
  word: string;
  category?: string;
  raw_hot?: number;
  num?: number;
  onboard_time?: number;
  rank?: number;
  realpos?: number;
}

interface WeiboBand {
  ok: number;
  data?: {
    band_list?: WeiboBandEntry[];
  };
}

const HASHTAG_TOPICS = ["新能源汽车", "智能驾驶", "汽车价格战", "比亚迪降价", "小米YU7", "尊界SUV", "大众召回"];

function topicSearchUrl(word: string): string {
  return `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${word}#`)}`;
}

/**
 * 微博汽车相关话题：
 * 1. 从 weibo.com/ajax/statuses/hot_band 过滤汽车关键词；
 * 2. 补充一组高频汽车话题标签（#新能源汽车#、#智能驾驶#、#汽车价格战# 等），
 *    当热榜中汽车词条过少时保证话题覆盖。
 */
export const weiboTopicAdapter: SourceAdapter = {
  id: "weibo-topic",
  name: "微博话题",
  homepage: "https://s.weibo.com/top/summary?cate=realtimehot",
  kind: "social",
  description: "微博热榜过滤汽车相关词条 + 高频汽车话题标签聚合",
  async fetch(): Promise<NewsItem[]> {
    const band = await fetchJson<WeiboBand>("https://weibo.com/ajax/statuses/hot_band", {
      headers: { Referer: "https://weibo.com/", Accept: "application/json, text/plain, */*" },
    });

    if (band.ok !== 1) {
      throw new Error("微博热榜接口返回异常");
    }

    const now = new Date();
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    for (const e of band.data?.band_list ?? []) {
      const word = cleanTitle(e.word ?? "");
      if (!word || seen.has(word)) continue;
      if (!(e.category ?? "").includes("汽车") && !isAutoRelated(word)) continue;
      seen.add(word);
      const onboard = e.onboard_time ? new Date(e.onboard_time * 1000) : now;
      items.push({
        id: makeItemId("weibo-topic", word),
        sourceId: "weibo-topic",
        title: `微博话题：${word}`,
        url: topicSearchUrl(word),
        summary: `微博热搜${e.realpos ? `第 ${e.realpos} 位` : ""}${e.category ? ` · ${e.category}` : ""}${e.num ? ` · 热度 ${e.num.toLocaleString("zh-CN")}` : ""}`,
        publishedAt: (Number.isNaN(onboard.getTime()) ? now : onboard).toISOString(),
        hotValue: e.raw_hot ?? e.num,
      });
    }

    // 热榜汽车词条通常只有 1~3 条，用固定汽车话题标签补齐，避免话题卡片过于单薄
    for (const t of HASHTAG_TOPICS) {
      if (seen.has(t)) continue;
      items.push({
        id: makeItemId("weibo-topic", t),
        sourceId: "weibo-topic",
        title: `微博话题：#${t}#`,
        url: topicSearchUrl(t),
        summary: "高频汽车话题标签",
        publishedAt: now.toISOString(),
        hotValue: 500_000,
      });
    }

    if (items.length === 0) {
      throw new Error("微博汽车话题未解析到任何条目");
    }
    return items;
  },
};
