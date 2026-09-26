"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HotspotsPayload } from "@/lib/types";

export type LoadState = "idle" | "loading" | "refreshing" | "ready" | "error";

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

export function useHotspots(): UseHotspotsResult {
  const [data, setData] = useState<HotspotsPayload | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshDurationMs, setLastRefreshDurationMs] = useState<number | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async (force: boolean) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setState((prev) => (prev === "ready" || prev === "error" ? (force ? "refreshing" : prev) : "loading"));
    setError(null);
    const started = performance.now();
    try {
      if (force) {
        const res = await fetch("/api/refresh", { method: "POST", signal: controller.signal });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `刷新失败（HTTP ${res.status}）`);
        }
      }
      const res = await fetch("/api/hotspots", { signal: controller.signal, cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `加载失败（HTTP ${res.status}）`);
      }
      const payload = (await res.json()) as HotspotsPayload;
      setData(payload);
      setState("ready");
      if (force) setLastRefreshDurationMs(Math.round(performance.now() - started));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load(false);
    const timer = setInterval(() => void load(false), POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      inflight.current?.abort();
    };
  }, [load]);

  return {
    data,
    state,
    error,
    refresh: () => load(true),
    reload: () => load(false),
    lastRefreshDurationMs,
  };
}
