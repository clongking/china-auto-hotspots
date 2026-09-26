import type { NewsItem } from "@/lib/types";
import {
  cleanTitle,
  dedupeByUrl,
  fetchText,
  isAutoRelated,
  makeItemId,
  type SourceAdapter,
} from "./base";

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return undefined;
  return m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

export const ithomeAdapter: SourceAdapter = {
  id: "ithome",
  name: "IT之家·车",
  homepage: "https://www.ithome.com/",
  kind: "rss",
  description: "IT之家全站 RSS，仅保留汽车相关条目",
  async fetch(): Promise<NewsItem[]> {
    const xml = await fetchText("https://www.ithome.com/rss/");
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    if (blocks.length === 0) {
      throw new Error("IT之家 RSS 未解析到条目");
    }
    const items: NewsItem[] = [];
    for (const b of blocks) {
      const title = tag(b, "title");
      const link = tag(b, "link");
      if (!title || !link) continue;
      const desc = tag(b, "description");
      const summary = desc ? cleanTitle(desc).slice(0, 160) : undefined;
      const t = cleanTitle(title);
      if (!isAutoRelated(t, summary)) continue;
      const pub = tag(b, "pubDate");
      const date = pub ? new Date(pub) : new Date();
      items.push({
        id: makeItemId("ithome", link),
        sourceId: "ithome",
        title: t,
        url: link,
        summary,
        publishedAt: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString(),
      });
    }
    return dedupeByUrl(items);
  },
};
