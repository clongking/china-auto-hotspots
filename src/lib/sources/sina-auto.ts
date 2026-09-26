import type { NewsItem } from "@/lib/types";
import {
  dateFromUrl,
  dedupeByUrl,
  extractAnchors,
  fetchText,
  makeItemId,
  type SourceAdapter,
} from "./base";

const PAGES = ["https://auto.sina.com.cn/", "https://auto.sina.com.cn/news/"];

export const sinaAutoAdapter: SourceAdapter = {
  id: "sina-auto",
  name: "新浪汽车",
  homepage: "https://auto.sina.com.cn/",
  kind: "html",
  description: "新浪汽车首页与新闻频道 HTML，提取 detail-*.shtml 文章链接（日期取自 URL）",
  async fetch(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(PAGES.map((p) => fetchText(p)));
    const now = new Date();
    const items: NewsItem[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const anchors = extractAnchors(
        r.value,
        /^https?:\/\/auto\.sina\.com\.cn\/[a-z\-/]+\/20\d{2}-\d{2}-\d{2}\/detail-[a-z0-9]+\.shtml/i,
      );
      for (const a of anchors) {
        const title = a.text.replace(/^\d{1,2}[.、]\s*/, "").trim();
        if (!title || title.length < 6 || title.length > 80) continue;
        const url = a.href.split("?")[0];
        const time = dateFromUrl(url, now) ?? now;
        items.push({
          id: makeItemId("sina-auto", url),
          sourceId: "sina-auto",
          title,
          url,
          publishedAt: time.toISOString(),
        });
      }
    }
    if (items.length === 0) {
      throw new Error("新浪汽车页面未解析到文章链接");
    }
    return dedupeByUrl(items);
  },
};
