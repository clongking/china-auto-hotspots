import type { NewsItem } from "@/lib/types";
import {
  cleanTitle,
  dedupeByUrl,
  fetchText,
  isAutoRelated,
  makeItemId,
  type SourceAdapter,
} from "./base";

const QUERIES = ["新能源汽车", "智能驾驶", "汽车价格战", "汽车降价", "小米汽车", "比亚迪", "汽车之家", "汽车资讯"];

/**
 * 搜狗微信搜索（weixin.sogou.com）结果页。
 * 不尝试绕过反爬，仅解析公开结果页中可见的标题、摘要、公众号名，
 * 链接使用搜狗搜索结果页链接；失败时由上层回退到示例数据。
 */
export const wechatAdapter: SourceAdapter = {
  id: "wechat",
  name: "微信公众号",
  homepage: "https://weixin.sogou.com/",
  kind: "social",
  description: "搜狗微信搜索多个汽车关键词的结果页（HTML），解析公众号文章标题与摘要",
  async fetch(): Promise<NewsItem[]> {
    const runs = await Promise.allSettled(
      QUERIES.map(async (q) => {
        const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(q)}&page=1`;
        const html = await fetchText(url);
        const items: NewsItem[] = [];
        // 搜狗结果页中每个结果都在 <h3> 内
        // 搜狗结果页结构：每个结果包含 h3 标题 + .txt-info 摘要 + .account 公众号名
        const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let m: RegExpExecArray | null;
        while ((m = liRe.exec(html))) {
          const block = m[1];
          const a = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);
          if (!a) continue;
          const href = cleanTitle(a[1]);
          const title = cleanTitle(a[2]);
          if (!title || title.length < 8 || title.length > 120) continue;
          if (!isAutoRelated(title)) continue;
          const link = href.startsWith("http") ? href : `https://weixin.sogou.com${href}`;
          const summary = block.match(/<p class="txt-info">([\s\S]*?)<\/p>/i)?.[1];
          const account = block.match(/<span class="account"[^>]*>([^<]+)<\/span>/i)?.[1] ?? block.match(/<a[^>]*id="weixin_account_name"[^>]*>([^<]+)<\/a>/i)?.[1];
          items.push({
            id: makeItemId("wechat", link),
            sourceId: "wechat",
            title,
            url: link,
            summary: `${account ? `${account} · ` : ""}微信公众号${summary ? " · " + cleanTitle(summary).slice(0, 60) : ""}`,
            publishedAt: new Date().toISOString(),
          });
        }
        return items;
      }),
    );

    const all = runs.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (all.length === 0) {
      throw new Error("搜狗微信搜索未解析到结果");
    }
    return dedupeByUrl(all);
  },
};
