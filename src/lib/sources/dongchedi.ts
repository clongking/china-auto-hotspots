import type { NewsItem } from "@/lib/types";
import { fetchJson, makeItemId, type SourceAdapter } from "./base";

interface RankEntry {
  series_id: number;
  series_name: string;
  brand_name: string;
  sub_brand_name?: string;
  rank: number;
  last_rank: number;
  count: number;
  price?: string;
  text?: string;
}

interface RankResponse {
  status: number;
  data?: {
    head_info?: { text?: string };
    list?: RankEntry[];
  };
}

function seriesLabel(e: RankEntry): string {
  return e.series_name.startsWith(e.brand_name) ? e.series_name : `${e.brand_name} ${e.series_name}`;
}

function rankUrl(type?: number): string {
  const base = "https://www.dongchedi.com/motor/pc/car/rank_data?aid=1839&app_name=auto_web_pc&count=30&offset=0";
  return type ? `${base}&rank_data_type=${type}` : base;
}

export const dongchediAdapter: SourceAdapter = {
  id: "dongchedi",
  name: "懂车帝",
  homepage: "https://www.dongchedi.com/rank",
  kind: "api",
  description: "懂车帝车型关注度榜与销量榜接口（JSON），转换为“车型热度”条目",
  async fetch(): Promise<NewsItem[]> {
    const [attention, sales] = await Promise.allSettled([
      fetchJson<RankResponse>(rankUrl()),
      fetchJson<RankResponse>(rankUrl(11)),
    ]);
    const items: NewsItem[] = [];
    const now = new Date();

    if (attention.status === "fulfilled" && attention.value.status === 0) {
      const asOf = attention.value.data?.head_info?.text?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
      const time = asOf ? new Date(`${asOf}T09:00:00+08:00`) : now;
      for (const e of attention.value.data?.list ?? []) {
        const moved =
          e.last_rank > 0 && e.last_rank !== e.rank
            ? e.last_rank > e.rank
              ? `，较昨日上升 ${e.last_rank - e.rank} 位`
              : `，较昨日下降 ${e.rank - e.last_rank} 位`
            : e.last_rank === -1
              ? "，新上榜"
              : "";
        const url = `https://www.dongchedi.com/auto/series/${e.series_id}`;
        items.push({
          id: makeItemId("dongchedi", `attention-${e.series_id}`),
          sourceId: "dongchedi",
          title: `懂车帝关注度榜第 ${e.rank} 名：${seriesLabel(e)}（${e.price ?? "价格待定"}）`,
          url,
          summary: `日均关注度 ${e.count.toLocaleString("zh-CN")}${moved}。${e.sub_brand_name && e.sub_brand_name !== e.brand_name ? `所属 ${e.sub_brand_name}。` : ""}`,
          publishedAt: time.toISOString(),
          hotValue: e.count,
        });
      }
    }

    if (sales.status === "fulfilled" && sales.value.status === 0) {
      for (const e of (sales.value.data?.list ?? []).slice(0, 20)) {
        const url = `https://www.dongchedi.com/auto/series/${e.series_id}`;
        items.push({
          id: makeItemId("dongchedi", `sales-${e.series_id}`),
          sourceId: "dongchedi",
          title: `懂车帝销量榜第 ${e.rank} 名：${seriesLabel(e)} 销量 ${e.count.toLocaleString("zh-CN")} 辆`,
          url,
          summary: `${e.text || "上月销量"}${e.price ? `，指导价 ${e.price}` : ""}`,
          publishedAt: now.toISOString(),
          hotValue: e.count,
        });
      }
    }

    if (items.length === 0) {
      throw new Error("懂车帝榜单接口无返回或结构变化");
    }
    return items;
  },
};
