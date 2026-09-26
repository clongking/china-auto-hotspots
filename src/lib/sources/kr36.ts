import type { NewsItem } from "@/lib/types";
import {
  cleanTitle,
  dedupeByUrl,
  fetchJson,
  isAutoRelated,
  makeItemId,
  type SourceAdapter,
} from "./base";

const GATEWAY = "https://gateway.36kr.com/api/mis/nav";

interface KrTemplate {
  itemId: number;
  widgetTitle?: string;
  widgetContent?: string;
  publishTime?: number;
  statRead?: number;
  statPraise?: number;
}

interface KrItem {
  itemId: number;
  itemType: number;
  route?: string;
  publishTime?: number;
  templateMaterial?: KrTemplate;
}

interface KrFlowResponse {
  code: number;
  data?: { itemList?: KrItem[]; hotRankList?: KrItem[] };
}

interface KrSearchResponse {
  code: number;
  data?: {
    itemList?: Array<{
      itemId: number;
      widgetTitle?: string;
      content?: string;
      publishTime?: number;
      route?: string;
    }>;
  };
}

function post<T>(path: string, param: Record<string, unknown>): Promise<T> {
  return fetchJson<T>(`${GATEWAY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner_id: "web", timestamp: Date.now(), param }),
  });
}

function itemUrl(item: { itemId: number; route?: string }): string {
  const r = item.route ?? "";
  if (r.startsWith("detail_newsflash")) return `https://36kr.com/newsflashes/${item.itemId}`;
  return `https://36kr.com/p/${item.itemId}`;
}

export const kr36Adapter: SourceAdapter = {
  id: "36kr",
  name: "36氪汽车",
  homepage: "https://36kr.com/information/travel/",
  kind: "api",
  description: "36氪开放网关：快讯流 + 热榜 + 站内搜索“汽车”，仅保留汽车相关条目",
  async fetch(): Promise<NewsItem[]> {
    const [flash, hot, search] = await Promise.allSettled([
      post<KrFlowResponse>("/newsflash/flow", {
        pageSize: 60,
        pageEvent: 0,
        pageCallback: "",
        siteId: 1,
        platformId: 2,
      }),
      post<KrFlowResponse>("/home/nav/rank/hot", { siteId: 1, platformId: 2 }),
      post<KrSearchResponse>("/search/resultbytype", {
        searchType: "article",
        searchWord: "汽车",
        sort: "date",
        pageSize: 30,
        pageEvent: 0,
        pageCallback: "",
        siteId: 1,
        platformId: 2,
      }),
    ]);

    const items: NewsItem[] = [];

    if (flash.status === "fulfilled" && flash.value.code === 0) {
      for (const it of flash.value.data?.itemList ?? []) {
        const tm = it.templateMaterial;
        if (!tm?.widgetTitle) continue;
        const title = cleanTitle(tm.widgetTitle);
        const summary = tm.widgetContent ? cleanTitle(tm.widgetContent) : undefined;
        if (!isAutoRelated(title, summary)) continue;
        const url = itemUrl(it);
        items.push({
          id: makeItemId("36kr", url),
          sourceId: "36kr",
          title,
          url,
          summary,
          publishedAt: new Date(tm.publishTime ?? it.publishTime ?? Date.now()).toISOString(),
        });
      }
    }

    if (hot.status === "fulfilled" && hot.value.code === 0) {
      for (const it of hot.value.data?.hotRankList ?? []) {
        const tm = it.templateMaterial;
        if (!tm?.widgetTitle) continue;
        const title = cleanTitle(tm.widgetTitle);
        if (!isAutoRelated(title)) continue;
        const url = itemUrl(it);
        items.push({
          id: makeItemId("36kr", url),
          sourceId: "36kr",
          title,
          url,
          publishedAt: new Date(tm.publishTime ?? it.publishTime ?? Date.now()).toISOString(),
          hotValue: tm.statRead,
        });
      }
    }

    if (search.status === "fulfilled" && search.value.code === 0) {
      for (const it of search.value.data?.itemList ?? []) {
        if (!it.widgetTitle) continue;
        const title = cleanTitle(it.widgetTitle);
        const summary = it.content ? cleanTitle(it.content) : undefined;
        if (!isAutoRelated(title, summary)) continue;
        const url = itemUrl(it);
        items.push({
          id: makeItemId("36kr", url),
          sourceId: "36kr",
          title,
          url,
          summary,
          publishedAt: new Date(it.publishTime ?? Date.now()).toISOString(),
        });
      }
    }

    const allFailed = [flash, hot, search].every((r) => r.status === "rejected");
    if (allFailed) {
      throw new Error("36氪网关三个接口均请求失败");
    }
    return dedupeByUrl(items);
  },
};
