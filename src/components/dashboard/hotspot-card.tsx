"use client";

import { ChevronDown, ExternalLink, Flame, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SOURCE_SHORT, formatRelative, topicClass } from "@/lib/format";
import type { Hotspot } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  rank: number;
  hotspot: Hotspot;
  maxScore: number;
  defaultOpen?: boolean;
}

function TrendIcon({ trend, delta }: { trend: Hotspot["trend"]; delta: number }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-up">
        <TrendingUp className="size-3.5" />
        上升{delta > 0 ? ` +${delta}` : ""}
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-down">
        <TrendingDown className="size-3.5" />
        下降{delta < 0 ? ` ${delta}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Minus className="size-3.5" />
      持平
    </span>
  );
}

export function HotspotCard({ rank, hotspot, maxScore, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const width = Math.max(4, Math.round((hotspot.score / Math.max(1, maxScore)) * 100));
  const rankTone =
    rank === 1
      ? "bg-chart-1 text-white"
      : rank === 2
        ? "bg-chart-2 text-white"
        : rank === 3
          ? "bg-chart-4 text-white"
          : "bg-muted text-muted-foreground";

  return (
    <article className="group rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-sm">
      <div className="flex gap-3 p-4">
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums", rankTone)}>
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-medium text-balance">{hotspot.title}</h3>
            <div className="flex items-center gap-1.5 text-chart-1">
              <Flame className="size-4" />
              <span className="text-lg font-semibold tabular-nums">{hotspot.score.toFixed(1)}</span>
            </div>
          </div>
          {hotspot.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{hotspot.summary}</p>
          )}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-chart-2 to-chart-1 transition-[width] duration-500"
              style={{ width: `${width}%` }}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <TrendIcon trend={hotspot.trend} delta={hotspot.trendDelta} />
            <span>{hotspot.mentionCount} 次提及</span>
            <span>{hotspot.sourceCount} 个信源</span>
            <span>最近 {formatRelative(hotspot.lastSeen)}</span>
            {hotspot.recent24h > 0 && <span>24 小时内 {hotspot.recent24h} 条</span>}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {hotspot.brands.map((b) => (
              <Badge key={b} variant="secondary" className="font-medium">
                {b}
              </Badge>
            ))}
            {hotspot.topics.map((t) => (
              <span
                key={t}
                className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ring-1", topicClass(t))}
              >
                {t}
              </span>
            ))}
            {hotspot.keywords.slice(0, 3).map((k) => (
              <Badge key={k} variant="outline" className="text-muted-foreground">
                {k}
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
              {hotspot.sourceIds.map((s) => (
                <span key={s} className="rounded bg-muted px-1.5 py-0.5">
                  {SOURCE_SHORT[s]}
                </span>
              ))}
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-muted-foreground"
            >
              {open ? "收起" : `关联新闻 ${hotspot.items.length}`}
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </Button>
          </div>
        </div>
      </div>
      {open && (
        <ul className="border-t bg-muted/30 px-4 py-2 sm:pl-15">
          {hotspot.items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 py-1.5 text-sm">
              <span className="mt-0.5 shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground ring-1 ring-foreground/10">
                {SOURCE_SHORT[it.sourceId]}
              </span>
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer noopener"
                className="min-w-0 flex-1 leading-snug hover:underline"
              >
                {it.title}
                <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
              </a>
              <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={it.publishedAt}>
                {formatRelative(it.publishedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
