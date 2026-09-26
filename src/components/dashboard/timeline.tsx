"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SOURCE_SHORT, dayLabel, formatClock, topicClass } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 20;

export function Timeline({ items }: { items: NewsItem[] }) {
  const [limit, setLimit] = useState(PAGE);
  const groups = useMemo(() => {
    const out: Array<{ day: string; items: NewsItem[] }> = [];
    for (const it of items.slice(0, limit)) {
      const day = dayLabel(it.publishedAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(it);
      else out.push({ day, items: [it] });
    }
    return out;
  }, [items, limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>近期时间线</CardTitle>
        <CardDescription>各信源最新资讯按发布时间倒序，榜单类条目按榜单更新时间计</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前筛选下没有资讯。</p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.day}>
                <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.day}</h4>
                <ol className="relative ml-2 space-y-3 border-l pl-4">
                  {g.items.map((it) => (
                    <li key={it.id} className="relative text-sm">
                      <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-chart-4" />
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <time className="text-xs text-muted-foreground tabular-nums" dateTime={it.publishedAt}>
                          {formatClock(it.publishedAt)}
                        </time>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {SOURCE_SHORT[it.sourceId]}
                        </span>
                        {(it.topics ?? []).slice(0, 2).map((t) => (
                          <span key={t} className={cn("rounded-full px-1.5 text-[10px] ring-1", topicClass(t))}>
                            {t}
                          </span>
                        ))}
                      </div>
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-0.5 block leading-snug hover:underline"
                      >
                        {it.title}
                        <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {limit < items.length && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  加载更多（还有 {items.length - limit} 条）
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
