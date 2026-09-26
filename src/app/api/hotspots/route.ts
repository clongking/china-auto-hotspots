import { NextResponse } from "next/server";
import { getHotspots } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/hotspots            返回缓存的热点数据（过期时后台刷新）
 * GET /api/hotspots?refresh=1  强制重新抓取后返回
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  try {
    const payload = await getHotspots({ forceRefresh: force });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "热点数据生成失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
