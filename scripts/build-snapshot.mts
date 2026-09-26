/**
 * 生成静态数据快照：抓取全部信源 → 分析 → 写入 public/data/hotspots.json
 * 用于 GitHub Pages 等无服务端的静态部署（配合 NEXT_PUBLIC_STATIC_MODE=1）。
 *
 *   npx tsx scripts/build-snapshot.mts
 *
 * 可选环境变量：
 *   SNAPSHOT_PREVIOUS_URL  上一次已发布的快照地址，用于计算趋势
 *   HOTSPOTS_OFFLINE=1     全部使用示例数据
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyze, type PreviousSnapshot } from "../src/lib/analysis";
import { collectAllSources, collectMockOnly } from "../src/lib/sources";
import type { HotspotsPayload } from "../src/lib/types";

async function loadPrevious(): Promise<PreviousSnapshot | undefined> {
  const url = process.env.SNAPSHOT_PREVIOUS_URL;
  if (!url) return undefined;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const prev = (await res.json()) as HotspotsPayload;
    return {
      hotspots: prev.hotspots.map((h) => ({ id: h.id, score: h.score, itemIds: h.items.map((i) => i.id) })),
    };
  } catch {
    return undefined;
  }
}

const started = Date.now();
const [collected, previous] = await Promise.all([
  process.env.HOTSPOTS_OFFLINE === "1" ? Promise.resolve(collectMockOnly()) : collectAllSources(),
  loadPrevious(),
]);
const payload = analyze(collected.items, collected.sources, previous);

const outDir = path.join(process.cwd(), "public", "data");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "hotspots.json"), JSON.stringify(payload), "utf8");

console.log(`快照已写入 public/data/hotspots.json（${Date.now() - started}ms）`);
console.log(`资讯 ${payload.stats.totalItems} 条，热点 ${payload.stats.hotspotCount} 个，在线信源 ${payload.stats.liveSources}/${payload.sources.length}`);
for (const s of payload.sources) {
  console.log(`  ${s.sourceId.padEnd(10)} ${s.status.padEnd(5)} ${String(s.itemCount).padStart(3)} 条 ${s.error ?? ""}`);
}
