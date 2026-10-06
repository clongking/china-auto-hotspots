"use client";

import { Activity, CircleAlert, Clock3, Database, Flame, Newspaper, RefreshCw, Rss } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SOURCE_NAMES, formatDateTime, formatRelative } from "@/lib/format";
import type { BrandStat, Hotspot, HotspotsPayload, SourceId, TopicStat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HotspotCard } from "./hotspot-card";
import { BrandRanking, SourceStatusPanel, TopicDistribution } from "./side-panels";
import { Timeline } from "./timeline";
import { SocialFeeds } from "./social-feeds";
import { STATIC_MODE, useHotspots } from "./use-hotspots";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card size="sm" className="gap-0">
      <CardContent className="flex items-center gap-3">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted", tone)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
          {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function applySourceFilter(payload: HotspotsPayload, selected: Set<SourceId>) {
  const all = selected.size === 0 || selected.size === payload.sources.length;
  if (all) {
    return { hotspots: payload.hotspots, topics: payload.topics, brands: payload.brands, timeline: payload.timeline };
  }
  const keep = (id: SourceId) => selected.has(id);
  const hotspots: Hotspot[] = payload.hotspots
    .map((h) => {
      const items = h.items.filter((it) => keep(it.sourceId));
      const sourceIds = Array.from(new Set(items.map((it) => it.sourceId)));
      return { ...h, items, mentionCount: items.length, sourceCount: sourceIds.length, sourceIds };
    })
    .filter((h) => h.items.length > 0);
  const timeline = payload.timeline.filter((it) => keep(it.sourceId));

  const topicCounts = new Map<string, number>();
  let topicTotal = 0;
  const brandAgg = new Map<string, { count: number; sources: Set<SourceId>; topics: Map<string, number> }>();
  for (const it of timeline) {
    for (const t of it.topics ?? []) {
      topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      topicTotal++;
    }
    for (const b of it.brands ?? []) {
      const agg = brandAgg.get(b) ?? { count: 0, sources: new Set<SourceId>(), topics: new Map<string, number>() };
      agg.count++;
      agg.sources.add(it.sourceId);
      for (const t of it.topics ?? []) agg.topics.set(t, (agg.topics.get(t) ?? 0) + 1);
      brandAgg.set(b, agg);
    }
  }
  const topicHotspots = new Map<string, number>();
  const brandHotspots = new Map<string, number>();
  for (const h of hotspots) {
    for (const t of h.topics) topicHotspots.set(t, (topicHotspots.get(t) ?? 0) + 1);
    for (const b of h.brands) brandHotspots.set(b, (brandHotspots.get(b) ?? 0) + 1);
  }
  const topics: TopicStat[] = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({
      topic,
      count,
      share: topicTotal ? Math.round((count / topicTotal) * 1000) / 10 : 0,
      hotspotCount: topicHotspots.get(topic) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
  const brands: BrandStat[] = Array.from(brandAgg.entries())
    .map(([brand, agg]) => ({
      brand,
      count: agg.count,
      sourceCount: agg.sources.size,
      hotspotCount: brandHotspots.get(brand) ?? 0,
      topTopics: Array.from(agg.topics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([t]) => t),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  return { hotspots, topics, brands, timeline };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-full max-w-2xl rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {STATIC_MODE ? "正在加载最新数据快照…" : "正在抓取 10 个信源并计算热度，首次加载约需 10 秒…"}
      </p>
    </div>
  );
}

export function Dashboard() {
  const { data, state, error, refresh, reload, lastRefreshDurationMs } = useHotspots();
  const [selected, setSelected] = useState<Set<SourceId>>(new Set());
  const [, setTick] = useState(0);

  // 每分钟刷新相对时间显示
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => (data ? applySourceFilter(data, selected) : null), [data, selected]);
  const maxScore = filtered?.hotspots[0]?.score ?? 100;
  const refreshing = state === "refreshing";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-chart-1 text-white shadow-sm">
              <Flame className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">中国汽车行业热点监控</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            聚合 36氪、汽车之家、懂车帝、新浪汽车、盖世、第一电动、车东西、IT之家与百度/微博热搜，
            基于关键词与实体提取，自动聚类出当前最受关注的行业热点事件。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-xs text-muted-foreground">
            {data ? (
              <>
                <p className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  最近更新 {formatRelative(data.generatedAt)}
                </p>
                <p className="tabular-nums">{formatDateTime(data.generatedAt)}</p>
              </>
            ) : (
              <p>尚未加载</p>
            )}
          </div>
          <Button onClick={() => void refresh()} disabled={state === "loading" || refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            {refreshing ? (STATIC_MODE ? "加载中…" : "抓取中…") : STATIC_MODE ? "重新加载" : "手动刷新"}
          </Button>
        </div>
      </header>

      {state === "error" && !data && (
        <Alert variant="destructive" className="mb-6">
          <CircleAlert />
          <AlertTitle>热点数据加载失败</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error ?? "未知错误"}</span>
            <Button size="sm" variant="outline" onClick={() => void reload()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {state === "loading" && !data && <LoadingSkeleton />}

      {data && filtered && (
        <div className="space-y-6">
          {state === "error" && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>刷新失败，正在显示上一次成功的数据</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {STATIC_MODE && (
            <p className="text-xs text-muted-foreground">
              当前为静态部署版：数据快照由 GitHub Actions 定时抓取生成（约每小时一次），“重新加载”只会拉取最新快照。
            </p>
          )}
          {!STATIC_MODE && lastRefreshDurationMs !== null && state === "ready" && (
            <p className="text-xs text-muted-foreground">
              本次手动刷新耗时 {(lastRefreshDurationMs / 1000).toFixed(1)} 秒，已重新抓取全部信源。
            </p>
          )}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="概览">
            <StatCard icon={Flame} label="热点事件" value={String(filtered.hotspots.length)} hint={`近 ${data.windowHours / 24} 天窗口`} tone="bg-chart-1/15 text-chart-1" />
            <StatCard icon={Newspaper} label="资讯总数" value={String(data.stats.totalItems)} hint={`24 小时内 ${data.stats.items24h} 条`} tone="bg-chart-4/15 text-chart-4" />
            <StatCard icon={Rss} label="在线信源" value={`${data.stats.liveSources} / ${data.sources.length}`} hint={data.stats.mockSources > 0 ? `${data.stats.mockSources} 个使用示例数据` : "全部实时抓取"} tone="bg-chart-3/15 text-chart-3" />
            <StatCard icon={Activity} label="上升中" value={String(filtered.hotspots.filter((h) => h.trend === "up").length)} hint={`下降 ${filtered.hotspots.filter((h) => h.trend === "down").length} 个`} tone="bg-chart-2/15 text-chart-2" />
          </section>

          <SocialFeeds data={data.timeline} />

          <section aria-label="按信源筛选" className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Database className="size-4" />
              按信源筛选
            </span>
            <ToggleGroup
              multiple
              variant="outline"
              size="sm"
              value={Array.from(selected)}
              onValueChange={(vals) => setSelected(new Set(vals as SourceId[]))}
              className="flex-wrap"
              aria-label="选择信源"
            >
              {data.sources.map((s) => (
                <ToggleGroupItem key={s.sourceId} value={s.sourceId} className="gap-1.5">
                  <span className={cn("size-1.5 rounded-full", s.status === "live" ? "bg-live" : "bg-mock")} />
                  {SOURCE_NAMES[s.sourceId]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {selected.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                清除筛选
              </Button>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="min-w-0 space-y-3 lg:col-span-2" aria-label="热点事件排行榜">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold">热点事件排行榜</h2>
                <span className="text-xs text-muted-foreground">热度分 = 提及量 × 跨信源覆盖 × 时间新鲜度</span>
              </div>
              {filtered.hotspots.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    所选信源暂无可聚类的热点事件，试试扩大信源范围或手动刷新。
                  </CardContent>
                </Card>
              ) : (
                filtered.hotspots.map((h, i) => (
                  <HotspotCard key={h.id} rank={i + 1} hotspot={h} maxScore={maxScore} defaultOpen={i === 0} />
                ))
              )}
            </section>
            <aside className="min-w-0 space-y-6">
              <TopicDistribution topics={filtered.topics} />
              <BrandRanking brands={filtered.brands} />
              <SourceStatusPanel sources={data.sources} />
            </aside>
          </div>

          <Timeline items={filtered.timeline} />
        </div>
      )}

      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        数据来自各信源公开页面与接口，仅用于行业动态监测；抓取失败的信源会自动切换为内置示例数据并在“信源状态”中标注。
      </footer>
    </div>
  );
}
