import type { NewsItem } from "@/lib/types";
import { cleanTitle, fetchJson, isAutoRelated, makeItemId, type SourceAdapter } from "./base";

interface BaiduEntry {
  word?: string;
  title?: string;
  url?: string;
  desc?: string | string[];
  hotScore?: string | number;
  index?: number;
  isTop?: boolean;
}

interface BaiduBoard {
  success: boolean;
  data?: {
    cards?: Array<{ component?: string; content?: Array<BaiduEntry | { content?: BaiduEntry[] }> }>;
  };
}

function flattenEntries(board: BaiduBoard): BaiduEntry[] {
  const out: BaiduEntry[] = [];
  for (const card of board.data?.cards ?? []) {
    for (const c of card.content ?? []) {
      if ("content" in c && Array.isArray(c.content)) {
        out.push(...c.content);
      } else if (("word" in c && c.word) || ("title" in c && c.title)) {
        out.push(c as BaiduEntry);
      }
    }
  }
  return out;
}

function descText(d: string | string[] | undefined): string | undefined {
  if (!d) return undefined;
  const s = Array.isArray(d) ? d.join("，") : d;
  return cleanTitle(s) || undefined;
}

export const baiduHotAdapter: SourceAdapter = {
  id: "baidu-hot",
  name: "百度热搜",
  homepage: "https://top.baidu.com/board?tab=realtime",
  kind: "hotlist",
  description: "百度热搜实时榜（仅保留汽车相关词条）+ 百度汽车热榜（车系关注度）JSON 接口",
  async fetch(): Promise<NewsItem[]> {
    const [realtime, car] = await Promise.allSettled([
      fetchJson<BaiduBoard>("https://top.baidu.com/api/board?platform=wise&tab=realtime"),
      fetchJson<BaiduBoard>("https://top.baidu.com/api/board?platform=wise&tab=car"),
    ]);
    if (realtime.status === "rejected" && car.status === "rejected") {
      throw new Error("百度热搜接口请求失败");
    }
    const now = new Date().toISOString();
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    if (realtime.status === "fulfilled" && realtime.value.success) {
      for (const e of flattenEntries(realtime.value)) {
        const word = cleanTitle(e.word ?? e.title ?? "");
        if (!word || seen.has(word)) continue;
        const desc = descText(e.desc);
        if (!isAutoRelated(word, desc)) continue;
        seen.add(word);
        items.push({
          id: makeItemId("baidu-hot", `realtime-${word}`),
          sourceId: "baidu-hot",
          title: word,
          url: e.url || `https://www.baidu.com/s?wd=${encodeURIComponent(word)}`,
          summary: desc,
          publishedAt: now,
          hotValue: e.hotScore ? Number(e.hotScore) : undefined,
        });
      }
    }

    if (car.status === "fulfilled" && car.value.success) {
      const entries = flattenEntries(car.value).slice(0, 30);
      entries.forEach((e, i) => {
        const name = cleanTitle(e.title ?? e.word ?? "");
        if (!name || seen.has(name)) return;
        seen.add(name);
        const desc = descText(e.desc);
        const rank = e.index ?? i + 1;
        items.push({
          id: makeItemId("baidu-hot", `car-${name}`),
          sourceId: "baidu-hot",
          title: `百度汽车热榜第 ${rank} 名：${name}${desc ? `（${desc}）` : ""}`,
          url: e.url || `https://www.baidu.com/s?wd=${encodeURIComponent(`${name} 汽车`)}`,
          summary: `百度汽车榜车系搜索热度 ${e.hotScore ? Number(e.hotScore).toLocaleString("zh-CN") : "—"}`,
          publishedAt: now,
          hotValue: e.hotScore ? Number(e.hotScore) : undefined,
        });
      });
    }
    return items;
  },
};
