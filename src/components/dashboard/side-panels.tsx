"use client";

import { CheckCircle2, CircleAlert, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOPIC_BAR_COLORS, formatRelative, topicClass } from "@/lib/format";
import type { BrandStat, SourceRunResult, TopicStat } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TopicDistribution({ topics }: { topics: TopicStat[] }) {
  const total = topics.reduce((s, t) => s + t.count, 0);
  const max = Math.max(1, ...topics.map((t) => t.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>话题分类分布</CardTitle>
        <CardDescription>按资讯命中的话题关键词统计，一条资讯可属于多个话题</CardDescription>
      </CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前筛选下没有可归类的话题。</p>
        ) : (
          <>
            <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {topics.map((t) => (
                <Tooltip key={t.topic}>
                  <TooltipTrigger
                    render={
                      <div
                        className={cn("h-full", TOPIC_BAR_COLORS[t.topic] ?? "bg-muted-foreground/40")}
                        style={{ width: `${(t.count / Math.max(1, total)) * 100}%` }}
                      />
                    }
                  />
                  <TooltipContent>
                    {t.topic} · {t.count} 条 · {t.share}%
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <ul className="space-y-2.5">
              {topics.map((t) => (
                <li key={t.topic} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ring-1", topicClass(t.topic))}>
                      {t.topic}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t.count} 条 · {t.hotspotCount} 个热点
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", TOPIC_BAR_COLORS[t.topic] ?? "bg-muted-foreground/40")}
                      style={{ width: `${(t.count / max) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BrandRanking({ brands }: { brands: BrandStat[] }) {
  const max = Math.max(1, ...brands.map((b) => b.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>热门品牌 / 车企榜</CardTitle>
        <CardDescription>按被提及的资讯条数排序，含子品牌与关联车型</CardDescription>
      </CardHeader>
      <CardContent>
        {brands.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前筛选下没有识别到品牌。</p>
        ) : (
          <ol className="space-y-2">
            {brands.slice(0, 12).map((b, i) => (
              <li key={b.brand} className="flex items-center gap-3 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{b.brand}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {b.count} 条 · {b.sourceCount} 源
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-4/80" style={{ width: `${(b.count / max) * 100}%` }} />
                    </div>
                    <div className="hidden gap-1 sm:flex">
                      {b.topTopics.map((t) => (
                        <span key={t} className={cn("rounded-full px-1.5 text-[10px] ring-1", topicClass(t))}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function SourceStatusPanel({ sources }: { sources: SourceRunResult[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>信源状态</CardTitle>
        <CardDescription>
          在线 {sources.filter((s) => s.status === "live").length} / {sources.length}，其余使用内置示例数据
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {sources.map((s) => (
            <li key={s.sourceId} className="flex items-center gap-2.5 py-2 text-sm">
              {s.status === "live" ? (
                <CheckCircle2 className="size-4 shrink-0 text-live" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-mock" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <a
                    href={s.homepage}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate font-medium hover:underline"
                  >
                    {s.name}
                  </a>
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground uppercase">
                    {s.kind}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {s.status === "live"
                    ? `${s.itemCount} 条 · ${(s.durationMs / 1000).toFixed(1)}s · ${formatRelative(s.fetchedAt)}`
                    : `示例数据 · ${s.error ?? "抓取失败"}`}
                </p>
              </div>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
