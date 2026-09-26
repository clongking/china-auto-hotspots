import type { NewsItem } from "@/lib/types";
import { cleanTitle, fetchJson, isAutoRelated, makeItemId, type SourceAdapter } from "./base";

interface WeiboBand {
  ok: number;
  data?: {
    realtime?: Array<{ word: string; note?: string; num?: number; raw_hot?: number; category?: string }>;
  };
}

interface WeiboContainer {
  ok: number;
  data?: {
    cards?: Array<{
      card_group?: Array<{ desc?: string; desc_extr?: string | number; scheme?: string }>;
    }>;
  };
}

export const weiboHotAdapter: SourceAdapter = {
  id: "weibo-hot",
  name: "微博热搜",
  homepage: "https://s.weibo.com/top/summary",
  kind: "hotlist",
  description: "微博热搜榜（网页/移动端接口），仅保留汽车相关词条；无访客 Cookie 时通常被拒绝，回退到示例数据",
  async fetch(): Promise<NewsItem[]> {
    const [band, mobile] = await Promise.allSettled([
      fetchJson<WeiboBand>("https://weibo.com/ajax/statuses/hot_band", {
        headers: { Referer: "https://weibo.com/" },
      }),
      fetchJson<WeiboContainer>(
        "https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot",
        { headers: { Referer: "https://m.weibo.cn/" } },
      ),
    ]);
    const now = new Date().toISOString();
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    if (band.status === "fulfilled" && band.value.ok === 1) {
      for (const e of band.value.data?.realtime ?? []) {
        const word = cleanTitle(e.word ?? "");
        if (!word || seen.has(word)) continue;
        if (!isAutoRelated(word, `${e.category ?? ""} ${e.note ?? ""}`)) continue;
        seen.add(word);
        items.push({
          id: makeItemId("weibo-hot", word),
          sourceId: "weibo-hot",
          title: word,
          url: `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${word}#`)}`,
          publishedAt: now,
          hotValue: e.raw_hot ?? e.num,
        });
      }
    }
    if (mobile.status === "fulfilled" && mobile.value.ok === 1) {
      for (const card of mobile.value.data?.cards ?? []) {
        for (const g of card.card_group ?? []) {
          const word = cleanTitle(g.desc ?? "");
          if (!word || seen.has(word) || !isAutoRelated(word)) continue;
          seen.add(word);
          items.push({
            id: makeItemId("weibo-hot", word),
            sourceId: "weibo-hot",
            title: word,
            url: `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${word}#`)}`,
            publishedAt: now,
            hotValue: Number(g.desc_extr) || undefined,
          });
        }
      }
    }

    if (band.status === "rejected" && mobile.status === "rejected") {
      throw new Error("微博热搜接口拒绝访问（需要访客 Cookie）");
    }
    return items;
  },
};
