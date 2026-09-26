"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HotspotsPayload } from "@/lib/types";

export type LoadState = "loading" | "refreshing" | "ready" | "error";

export interface UseHotspotsResult {
  data: HotspotsPayload | null;
  state: LoadState;
  error: string | null;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
  lastRefreshDurationMs: number | null;
}

/** 自动轮询间隔：与服务端缓存 TTL 对齐，避免频繁抓取 */
const POLL_INTERVAL_MS = 5 * 60_000;

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

/** 纯请求函数：force 时先触发服务端重新抓取，再读取最新结果 */
async function fetchPayload(force: boolean, signal: AbortSignal): Promise<HotspotsPayload> {
  if (force) {
    const res = await fetch("/api/refresh", { method: "POST", signal });
    if (!res.ok) throw new Error(await readError(res, `刷新失败（HTTP ${res.status}）`));
  }
  const res = await fetch("/api/hotspots", { signal, cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res, `加载失败（HTTP ${res.status}）`));
  return (await res.json()) as HotspotsPayload;
}

export function useHotspots(): UseHotspotsResult {
  const [data, setData] = useState<HotspotsPayload | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshDurationMs, setLastRefreshDurationMs] = useState<number | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const run = useCallback((force: boolean): Promise<void> => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const started = performance.now();
    return fetchPayload(force, controller.signal)
      .then((payload) => {
        setData(payload);
        setState("ready");
        setError(null);
        if (force) setLastRefreshDurationMs(Math.round(performance.now() - started));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      });
  }, []);

  useEffect(() => {
    void run(false);
    const timer = setInterval(() => void run(false), POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      inflight.current?.abort();
    };
  }, [run]);

  const refresh = useCallback(() => {
    setState("refreshing");
    setError(null);
    return run(true);
  }, [run]);

  const reload = useCallback(() => {
    setState("loading");
    setError(null);
    return run(false);
  }, [run]);

  return { data, state, error, refresh, reload, lastRefreshDurationMs };
}
