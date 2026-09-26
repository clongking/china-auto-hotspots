import type { NewsItem } from "@/lib/types";
import { cleanTitle, fetchJson, makeItemId, type SourceAdapter } from "./base";

interface WpPost {
  id: number;
  date: string;
  date_gmt?: string;
  link: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
}

export const chedongxiAdapter: SourceAdapter = {
  id: "chedongxi",
  name: "车东西",
  homepage: "https://chedongxi.com/",
  kind: "api",
  description: "车东西 WordPress REST API（/wp-json/wp/v2/posts），含标题、摘要与发布时间",
  async fetch(): Promise<NewsItem[]> {
    const posts = await fetchJson<WpPost[]>(
      "https://chedongxi.com/wp-json/wp/v2/posts?per_page=40&_fields=id,date,date_gmt,link,title,excerpt",
    );
    if (!Array.isArray(posts) || posts.length === 0) {
      throw new Error("车东西接口返回为空");
    }
    return posts.map((p) => {
      const published = p.date_gmt ? new Date(`${p.date_gmt}Z`) : new Date(`${p.date}+08:00`);
      return {
        id: makeItemId("chedongxi", p.link),
        sourceId: "chedongxi",
        title: cleanTitle(p.title.rendered),
        url: p.link,
        summary: p.excerpt?.rendered ? cleanTitle(p.excerpt.rendered) : undefined,
        publishedAt: published.toISOString(),
      };
    });
  },
};
