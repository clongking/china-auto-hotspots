import type { NewsItem } from "@/lib/types";
import { cleanTitle, fetchJson, isAutoRelated, makeItemId, type SourceAdapter } from "./base";

interface WeiboBandEntry {
  word: string;
  note?: string;
  num?: number;
  raw_hot?: number;
  category?: string;
  rank?: number;
  realpos?: number;
  onboard_time?: number;
  word_scheme?: string;
}

interface WeiboBand {
  ok: number;
  data?: {
    band_list?: WeiboBandEntry[];
    realtime?: WeiboBandEntry[];
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

function searchUrl(word: string): string {
  return `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${word}#`)}`;
}

export const weiboHotAdapter: SourceAdapter = {
  id: "weibo-hot",
  name: "微博热搜",
  homepage: "https://s.weibo.com/top/summary",
  kind: "hotlist",
  description: "微博热搜榜接口（weibo.com/ajax/statuses/hot_band），保留分类为“汽车”或命中汽车关键词的词条",
  async fetch(): Promise<NewsItem[]> {
    const [band, mobile] = await Promise.allSettled([
      fetchJson<WeiboBand>("https://weibo.com/ajax/statuses/hot_band", {
        headers: { Referer: "https://weibo.com/", Accept: "application/json, text/plain, */*" },
      }),
      fetchJson<WeiboContainer>(
        "https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot",
        { headers: { Referer: "https://m.weibo.cn/" } },
      ),
    ]);
    const now = new Date();
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    const bandOk = band.status === "fulfilled" && band.value.ok === 1;
    if (bandOk) {
      const list = [...(band.value.data?.band_list ?? []), ...(band.value.data?.realtime ?? [])];
      for (const e of list) {
        const word = cleanTitle(e.word ?? "");
        if (!word || seen.has(word)) continue;
        const isCarCategory = (e.category ?? "").includes("汽车");
        if (!isCarCategory && !isAutoRelated(word, `${e.category ?? ""} ${e.note ?? ""}`)) continue;
        seen.add(word);
        const onboard = e.onboard_time ? new Date(e.onboard_time * 1000) : now;
        const rank = e.realpos ?? e.rank;
        items.push({
          id: makeItemId("weibo-hot", word),
          sourceId: "weibo-hot",
          title: word,
          url: searchUrl(word),
          summary: `微博热搜${rank ? `第 ${rank} 位` : ""}${e.category ? ` · ${e.category}` : ""}${e.num ? ` · 热度 ${e.num.toLocaleString("zh-CN")}` : ""}`,
          publishedAt: (Number.isNaN(onboard.getTime()) ? now : onboard).toISOString(),
          hotValue: e.raw_hot ?? e.num,
        });
      }
    }

    const mobileOk = mobile.status === "fulfilled" && mobile.value.ok === 1;
    if (mobileOk) {
      for (const card of mobile.value.data?.cards ?? []) {
        for (const g of card.card_group ?? []) {
          const word = cleanTitle(g.desc ?? "");
          if (!word || seen.has(word) || !isAutoRelated(word)) continue;
          seen.add(word);
          items.push({
            id: makeItemId("weibo-hot", word),
            sourceId: "weibo-hot",
            title: word,
            url: searchUrl(word),
            publishedAt: now.toISOString(),
            hotValue: Number(g.desc_extr) || undefined,
          });
        }
      }
    }

    if (!bandOk && !mobileOk) {
      throw new Error("微博热搜接口拒绝访问（需要登录或访客 Cookie）");
    }
    return items;
  },
};
