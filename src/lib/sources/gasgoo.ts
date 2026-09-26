import type { NewsItem } from "@/lib/types";
import {
  dateFromUrl,
  dedupeByUrl,
  extractAnchors,
  fetchText,
  makeItemId,
  type SourceAdapter,
} from "./base";

export const gasgooAdapter: SourceAdapter = {
  id: "gasgoo",
  name: "盖世汽车",
  homepage: "https://auto.gasgoo.com/",
  kind: "html",
  description: "盖世汽车资讯首页 HTML，提取 /news/YYYYMM/*.shtml 文章链接",
  async fetch(): Promise<NewsItem[]> {
    const html = await fetchText("https://auto.gasgoo.com/");
    const now = new Date();
    const anchors = extractAnchors(
      html,
      /^https?:\/\/auto\.gasgoo\.com\/news\/\d{6}\/[A-Za-z0-9]+\.shtml/i,
    );
    const items: NewsItem[] = [];
    for (const a of anchors) {
      if (!a.text || a.text.length < 6 || a.text.length > 80) continue;
      // 文件名形如 24I70473141C108：前两位是当月日期
      const day = a.href.match(/\/news\/(\d{4})(\d{2})\/(\d{2})[A-Za-z]/);
      const time = day
        ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0)
        : (dateFromUrl(a.href, now) ?? now);
      items.push({
        id: makeItemId("gasgoo", a.href),
        sourceId: "gasgoo",
        title: a.text,
        url: a.href,
        publishedAt: (time > now ? now : time).toISOString(),
      });
    }
    if (items.length === 0) {
      throw new Error("盖世汽车页面未解析到文章链接");
    }
    return dedupeByUrl(items);
  },
};
