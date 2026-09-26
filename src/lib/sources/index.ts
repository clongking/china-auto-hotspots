import type { NewsItem, SourceId, SourceRunResult } from "@/lib/types";
import { getMockItems } from "@/lib/mock";
import { autohomeAdapter } from "./autohome";
import { baiduHotAdapter } from "./baidu-hot";
import type { SourceAdapter } from "./base";
import { chedongxiAdapter } from "./chedongxi";
import { d1evAdapter } from "./d1ev";
import { dongchediAdapter } from "./dongchedi";
import { gasgooAdapter } from "./gasgoo";
import { ithomeAdapter } from "./ithome";
import { kr36Adapter } from "./kr36";
import { sinaAutoAdapter } from "./sina-auto";
import { weiboHotAdapter } from "./weibo-hot";

/** 注册新信源：实现 SourceAdapter 并加入此数组即可 */
export const SOURCE_ADAPTERS: SourceAdapter[] = [
  kr36Adapter,
  autohomeAdapter,
  dongchediAdapter,
  sinaAutoAdapter,
  gasgooAdapter,
  d1evAdapter,
  chedongxiAdapter,
  ithomeAdapter,
  baiduHotAdapter,
  weiboHotAdapter,
];

export const SOURCE_IDS: SourceId[] = SOURCE_ADAPTERS.map((a) => a.id);

const SOURCE_TIMEOUT_MS = 25_000;

/** 单个信源最少需要多少条有效结果才视为“在线”，否则回退到示例数据；热搜榜里汽车词条本就稀少，有 1 条即算在线 */
const MIN_LIVE_ITEMS = 3;
const MIN_LIVE_ITEMS_HOTLIST = 1;

/** 单信源最多保留的条目数（取最新），避免单一信源主导热度 */
const MAX_ITEMS_PER_SOURCE = 80;

export interface CollectResult {
  items: NewsItem[];
  sources: SourceRunResult[];
}

async function runAdapter(adapter: SourceAdapter): Promise<{ items: NewsItem[]; result: SourceRunResult }> {
  const started = Date.now();
  const meta = {
    sourceId: adapter.id,
    name: adapter.name,
    homepage: adapter.homepage,
    kind: adapter.kind,
  };
  try {
    const items = await Promise.race([
      adapter.fetch(),
      new Promise<NewsItem[]>((_, reject) =>
        setTimeout(() => reject(new Error(`超过 ${SOURCE_TIMEOUT_MS / 1000}s 未响应`)), SOURCE_TIMEOUT_MS),
      ),
    ]);
    const valid = items
      .filter((it) => it.title && it.url && it.publishedAt)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, MAX_ITEMS_PER_SOURCE);
    const minLive = adapter.kind === "hotlist" ? MIN_LIVE_ITEMS_HOTLIST : MIN_LIVE_ITEMS;
    if (valid.length < minLive) {
      const mock = getMockItems(adapter.id);
      return {
        items: mock,
        result: {
          ...meta,
          status: "mock",
          itemCount: mock.length,
          durationMs: Date.now() - started,
          fetchedAt: new Date().toISOString(),
          error: valid.length === 0 ? "抓取成功但未匹配到汽车相关内容，已使用示例数据" : `仅解析到 ${valid.length} 条，已使用示例数据`,
        },
      };
    }
    return {
      items: valid,
      result: {
        ...meta,
        status: "live",
        itemCount: valid.length,
        durationMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    const mock = getMockItems(adapter.id);
    return {
      items: mock,
      result: {
        ...meta,
        status: "mock",
        itemCount: mock.length,
        durationMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
        error: describeError(err),
      },
    };
  }
}

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  if (err.name === "AbortError") return "请求超时";
  if (cause?.code) return `${err.message}（${cause.code}）`;
  if (cause?.message) return `${err.message}（${cause.message}）`;
  return err.message;
}

export async function collectAllSources(): Promise<CollectResult> {
  const runs = await Promise.all(SOURCE_ADAPTERS.map((a) => runAdapter(a)));
  return {
    items: runs.flatMap((r) => r.items),
    sources: runs.map((r) => r.result),
  };
}

/** 完全离线模式：全部使用示例数据（用于网络不可用或测试） */
export function collectMockOnly(): CollectResult {
  const now = new Date().toISOString();
  return {
    items: SOURCE_ADAPTERS.flatMap((a) => getMockItems(a.id)),
    sources: SOURCE_ADAPTERS.map((a) => ({
      sourceId: a.id,
      name: a.name,
      homepage: a.homepage,
      kind: a.kind,
      status: "mock" as const,
      itemCount: getMockItems(a.id).length,
      durationMs: 0,
      fetchedAt: now,
      error: "离线模式，使用示例数据",
    })),
  };
}
