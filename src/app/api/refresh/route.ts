import { NextResponse } from "next/server";
import { refreshHotspots } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/refresh           立即重新抓取全部信源并重算热点
 * POST /api/refresh?mock=1    强制使用示例数据（离线演示）
 * GET 同 POST，便于 cron 之类的定时器直接调用
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const mockOnly = url.searchParams.get("mock") === "1";
  const started = Date.now();
  try {
    const payload = await refreshHotspots({ mockOnly });
    return NextResponse.json(
      {
        ok: true,
        generatedAt: payload.generatedAt,
        durationMs: Date.now() - started,
        stats: payload.stats,
        sources: payload.sources.map((s) => ({
          sourceId: s.sourceId,
          status: s.status,
          itemCount: s.itemCount,
          error: s.error,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;
