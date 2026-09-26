import type { NewsItem } from "@/lib/types";
import {
  cleanTitle,
  dateFromUrl,
  dedupeByUrl,
  fetchText,
  makeItemId,
  parseChineseTime,
  type SourceAdapter,
} from "./base";

export const autohomeAdapter: SourceAdapter = {
  id: "autohome",
  name: "汽车之家",
  homepage: "https://www.autohome.com.cn/all/",
  kind: "html",
  description: "汽车之家资讯“全部”频道页（GB2312 编码 HTML），解析标题、摘要与相对时间；不可达时退到新闻频道页",
  async fetch(): Promise<NewsItem[]> {
    // 汽车之家对单 IP 偶发连接挂起，两个列表页并发请求，任一成功即可
    const html = await Promise.any([
      fetchText("https://www.autohome.com.cn/all/", { encoding: "gb2312" }),
      fetchText("https://www.autohome.com.cn/news/", { encoding: "gb2312" }),
    ]).catch((err: AggregateError) => {
      throw err.errors?.[0] ?? err;
    });
    const flat = html.replace(/[\r\n]+/g, " ");
    const now = new Date();
    const items: NewsItem[] = [];

    // 列表项：<li data-artidanchor="..."> <a href="//www.autohome.com.cn/news/202609/1317446.html#..."> ... <h3>标题</h3> ... <span class="fn-left">23分钟前</span> ... <p>摘要</p>
    const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let m: RegExpExecArray | null;
    while ((m = liRe.exec(flat))) {
      const block = m[1];
      if (/^\s*<li[^>]*id="ad_/.test(m[0])) continue;
      const href = block.match(/href="(\/\/www\.autohome\.com\.cn\/news\/\d+\/\d+\.html)[^"]*"/)?.[1];
      if (!href) continue;
      const titleRaw = block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/)?.[1];
      if (!titleRaw) continue;
      const title = cleanTitle(titleRaw);
      if (title.length < 6) continue;
      const summary = block.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1];
      const timeText = block.match(/<span class="fn-left">([^<]+)<\/span>/)?.[1];
      const url = `https:${href}`;
      // 列表页只有相对时间；没有时间标签的（如置顶推广位）按“刚刚”处理，避免误判为月初
      const fullDate = /\/\d{8}\//.test(url) ? dateFromUrl(url, now) : null;
      const time = (timeText && parseChineseTime(timeText, now)) || fullDate || now;
      items.push({
        id: makeItemId("autohome", url),
        sourceId: "autohome",
        title,
        url,
        summary: summary ? cleanTitle(summary).replace(/^\[汽车之家[^\]]*\]\s*/, "") : undefined,
        publishedAt: time.toISOString(),
      });
    }

    if (items.length === 0) {
      throw new Error("页面结构可能已变化，未解析到任何资讯");
    }
    return dedupeByUrl(items);
  },
};
