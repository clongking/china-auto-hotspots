"use client";

import { ExternalLink, PlayCircle, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatRelative } from "@/lib/format";
import type { NewsItem, SourceId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  items: NewsItem[];
  sourceId: SourceId;
  title: string;
  description: string;
  icon: typeof MessageCircle;
  emptyText: string;
  colorClass: string;
}

function SocialCard({ items, title, description, icon: Icon, emptyText, colorClass }: Props) {
  const sorted = [...items].sort((a, b) => (b.hotValue ?? 0) - (a.hotValue ?? 0)).slice(0, 6);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={cn("size-5", colorClass)} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="space-y-2.5">
            {sorted.map((it, i) => (
              <li key={it.id} className="group text-sm">
                <a
                  href={it.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-start gap-2.5 leading-snug hover:underline"
                >
                  <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white", colorClass.replace("text-", "bg-"))}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{it.title}</span>
                    {it.summary && (
                      <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">{it.summary}</span>
                    )}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {it.hotValue ? (
                        <span>
                          {it.sourceId === "bilibili" ? "播放" : "热度"} {formatNumber(it.hotValue)}
                        </span>
                      ) : null}
                      <span>{formatRelative(it.publishedAt)}</span>
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function SocialFeeds({ data }: { data: NewsItem[] }) {
  const bySource = (id: SourceId) => data.filter((it) => it.sourceId === id);
  return (
    <section aria-label="社交与视频信源热门" className="grid gap-4 md:grid-cols-3">
      <SocialCard
        items={bySource("wechat")}
        sourceId="wechat"
        title="微信公众号热门"
        description="搜狗微信搜索汽车关键词的结果"
        icon={MessageCircle}
        emptyText="暂无微信公众号热门条目"
        colorClass="text-chart-3"
      />
      <SocialCard
        items={bySource("weibo-topic")}
        sourceId="weibo-topic"
        title="微博话题热榜"
        description="微博汽车相关热搜与高频汽车话题"
        icon={MessageCircle}
        emptyText="暂无微博汽车话题"
        colorClass="text-chart-1"
      />
      <SocialCard
        items={bySource("bilibili")}
        sourceId="bilibili"
        title="bilibili 汽车热榜"
        description="汽车生活 / 汽车科技区排行榜"
        icon={PlayCircle}
        emptyText="暂无 bilibili 汽车区热门视频"
        colorClass="text-chart-5"
      />
    </section>
  );
}
