import type { NewsItem } from "@/lib/types";
import {
  dedupeByUrl,
  extractAnchors,
  fetchText,
  makeItemId,
  type SourceAdapter,
} from "./base";

export const d1evAdapter: SourceAdapter = {
  id: "d1ev",
  name: "第一电动",
  homepage: "https://www.d1ev.com/news",
  kind: "html",
  description: "第一电动网新闻列表页 HTML，提取 /news/{栏目}/{id} 链接（按 id 倒序估算时间）",
  async fetch(): Promise<NewsItem[]> {
    const html = await fetchText("https://www.d1ev.com/news");
    const anchors = extractAnchors(html, /^(https?:\/\/www\.d1ev\.com)?\/news\/[a-z\-]+\/\d+$/i);
    const now = new Date();
    const rows = anchors
      .filter((a) => a.text && a.text.length >= 6 && a.text.length <= 100)
      .map((a) => {
        const url = a.href.startsWith("http") ? a.href : `https://www.d1ev.com${a.href}`;
        const id = Number(url.match(/\/(\d+)$/)?.[1] ?? 0);
        return { url, title: a.text, id };
      });
    if (rows.length === 0) {
      throw new Error("第一电动页面未解析到文章链接");
    }
    // 列表页没有直接给时间，按文章 id 排序：越新的 id 越大，按每 40 分钟一篇的粗略节奏倒推
    const maxId = Math.max(...rows.map((r) => r.id));
    const items: NewsItem[] = rows.map((r) => {
      const hoursBack = Math.min(72, Math.max(0, (maxId - r.id) / 3));
      return {
        id: makeItemId("d1ev", r.url),
        sourceId: "d1ev",
        title: r.title,
        url: r.url,
        publishedAt: new Date(now.getTime() - hoursBack * 3_600_000).toISOString(),
      };
    });
    return dedupeByUrl(items);
  },
};
