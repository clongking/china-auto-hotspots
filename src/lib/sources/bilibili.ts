import type { NewsItem } from "@/lib/types";
import { cleanTitle, fetchJson, makeItemId, type SourceAdapter } from "./base";

interface BiliVideo {
  bvid: string;
  title: string;
  play: number;
  video_review: number;
  review?: number;
  favorites?: number;
  coins?: number;
  pts?: number;
  author: string;
  mid?: number;
  create: string;
  description?: string;
  pic?: string;
  duration?: string;
}

interface BiliRankResponse {
  code: number;
  data?: BiliVideo[];
}

const RIDS = [
  { rid: 176, name: "汽车生活" },
  { rid: 245, name: "汽车科技" },
];

export const bilibiliAdapter: SourceAdapter = {
  id: "bilibili",
  name: "bilibili 汽车热榜",
  homepage: "https://www.bilibili.com/v/car/",
  kind: "social",
  description: "bilibili 汽车区排行榜（汽车生活 rid=176 / 汽车科技 rid=245），纳入播放量与弹幕数作为热度信号",
  async fetch(): Promise<NewsItem[]> {
    const runs = await Promise.allSettled(
      RIDS.map(async ({ rid, name }) => {
        const data = await fetchJson<BiliRankResponse>(
          `https://api.bilibili.com/x/web-interface/ranking/region?rid=${rid}&day=3`,
          { headers: { Referer: "https://www.bilibili.com/v/car/" } },
        );
        if (data.code !== 0 || !Array.isArray(data.data)) throw new Error(`${name} 榜单接口返回异常`);
        return data.data.map((v) => {
          const published = v.create ? new Date(`${v.create.replace(/-/g, "/")} GMT+0800`) : new Date();
          return {
            id: makeItemId("bilibili", v.bvid),
            sourceId: "bilibili" as const,
            title: cleanTitle(v.title),
            url: `https://www.bilibili.com/video/${v.bvid}`,
            summary: `UP：${v.author} · 播放量 ${v.play.toLocaleString("zh-CN")} · 弹幕 ${v.video_review.toLocaleString("zh-CN")}${v.pts ? ` · 综合得分 ${v.pts.toLocaleString("zh-CN")}` : ""}`,
            publishedAt: (Number.isNaN(published.getTime()) ? new Date() : published).toISOString(),
            hotValue: v.pts ?? v.play,
          };
        });
      }),
    );

    const items = runs.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (items.length === 0) {
      throw new Error("bilibili 汽车区排行榜无返回");
    }
    return items;
  },
};
