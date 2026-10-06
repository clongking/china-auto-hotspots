import type { SourceId } from "@/lib/types";

export const SOURCE_NAMES: Record<SourceId, string> = {
  "36kr": "36氪汽车",
  autohome: "汽车之家",
  dongchedi: "懂车帝",
  "sina-auto": "新浪汽车",
  gasgoo: "盖世汽车",
  d1ev: "第一电动",
  chedongxi: "车东西",
  ithome: "IT之家·车",
  "baidu-hot": "百度热搜",
  "weibo-hot": "微博热搜",
  wechat: "微信公众号",
  "weibo-topic": "微博话题",
  bilibili: "bilibili 汽车热榜",
};

export const SOURCE_SHORT: Record<SourceId, string> = {
  "36kr": "36氪",
  autohome: "之家",
  dongchedi: "懂车帝",
  "sina-auto": "新浪",
  gasgoo: "盖世",
  d1ev: "第一电动",
  chedongxi: "车东西",
  ithome: "IT之家",
  "baidu-hot": "百度",
  "weibo-hot": "微博",
  wechat: "微信",
  "weibo-topic": "微博话题",
  bilibili: "B站",
};

export const TOPIC_COLORS: Record<string, string> = {
  价格战: "bg-chart-1/15 text-chart-1 ring-chart-1/30",
  新能源: "bg-chart-3/15 text-chart-3 ring-chart-3/30",
  智驾: "bg-chart-4/15 text-chart-4 ring-chart-4/30",
  出海: "bg-chart-5/15 text-chart-5 ring-chart-5/30",
  召回: "bg-chart-1/20 text-chart-1 ring-chart-1/40",
  政策: "bg-chart-2/15 text-chart-2 ring-chart-2/30",
  新车上市: "bg-chart-4/10 text-chart-4 ring-chart-4/20",
  销量交付: "bg-chart-3/10 text-chart-3 ring-chart-3/20",
  资本经营: "bg-chart-2/10 text-chart-2 ring-chart-2/20",
  供应链技术: "bg-chart-5/10 text-chart-5 ring-chart-5/20",
};

export const TOPIC_BAR_COLORS: Record<string, string> = {
  价格战: "bg-chart-1",
  新能源: "bg-chart-3",
  智驾: "bg-chart-4",
  出海: "bg-chart-5",
  召回: "bg-chart-1/70",
  政策: "bg-chart-2",
  新车上市: "bg-chart-4/60",
  销量交付: "bg-chart-3/60",
  资本经营: "bg-chart-2/60",
  供应链技术: "bg-chart-5/60",
};

export function topicClass(topic: string): string {
  return TOPIC_COLORS[topic] ?? "bg-muted text-muted-foreground ring-border";
}

export function formatRelative(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "时间未知";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "时间未知";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${formatClock(iso)}`;
}

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return "今天";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatNumber(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)} 亿`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(n >= 10_0000 ? 0 : 1)} 万`;
  return n.toLocaleString("zh-CN");
}
