import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyze, type PreviousSnapshot } from "@/lib/analysis";
import { collectAllSources, collectMockOnly } from "@/lib/sources";
import type { HotspotsPayload } from "@/lib/types";

/** 缓存有效期：超过后 GET /api/hotspots 会自动触发一次重新抓取 */
export const CACHE_TTL_MS = Number(process.env.HOTSPOTS_TTL_MINUTES ?? 15) * 60_000;

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "hotspots.json");

interface CacheFile {
  payload: HotspotsPayload;
  previous?: PreviousSnapshot;
}

interface StoreState {
  payload: HotspotsPayload | null;
  previous?: PreviousSnapshot;
  inflight: Promise<HotspotsPayload> | null;
  loadedFromDisk: boolean;
}

// 挂到 globalThis 上，避免 Next dev 热更新时丢失内存缓存
const g = globalThis as unknown as { __hotspotStore?: StoreState };
const state: StoreState = g.__hotspotStore ?? { payload: null, inflight: null, loadedFromDisk: false };
g.__hotspotStore = state;

async function loadFromDisk(): Promise<void> {
  if (state.loadedFromDisk) return;
  state.loadedFromDisk = true;
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed?.payload?.generatedAt) {
      state.payload = parsed.payload;
      state.previous = parsed.previous;
    }
  } catch {
    // 无缓存文件或损坏，忽略
  }
}

async function persist(): Promise<void> {
  if (!state.payload) return;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const file: CacheFile = { payload: state.payload, previous: state.previous };
    await writeFile(CACHE_FILE, JSON.stringify(file), "utf8");
  } catch {
    // 只读文件系统等场景下忽略持久化失败，内存缓存仍可用
  }
}

function snapshotOf(payload: HotspotsPayload): PreviousSnapshot {
  return {
    hotspots: payload.hotspots.map((h) => ({
      id: h.id,
      score: h.score,
      itemIds: h.items.map((i) => i.id),
    })),
  };
}

export async function refreshHotspots(options: { mockOnly?: boolean } = {}): Promise<HotspotsPayload> {
  if (state.inflight) return state.inflight;
  state.inflight = (async () => {
    await loadFromDisk();
    const previous = state.payload ? snapshotOf(state.payload) : state.previous;
    const collected = options.mockOnly || process.env.HOTSPOTS_OFFLINE === "1"
      ? collectMockOnly()
      : await collectAllSources();
    const payload = analyze(collected.items, collected.sources, previous);
    state.previous = previous;
    state.payload = payload;
    await persist();
    return payload;
  })();
  try {
    return await state.inflight;
  } finally {
    state.inflight = null;
  }
}

export function isStale(payload: HotspotsPayload): boolean {
  return Date.now() - new Date(payload.generatedAt).getTime() > CACHE_TTL_MS;
}

export async function getHotspots(options: { forceRefresh?: boolean } = {}): Promise<HotspotsPayload> {
  await loadFromDisk();
  if (options.forceRefresh || !state.payload) {
    return refreshHotspots();
  }
  if (isStale(state.payload)) {
    // 过期时后台刷新，先返回旧数据，避免请求阻塞
    void refreshHotspots().catch(() => undefined);
  }
  return state.payload;
}
