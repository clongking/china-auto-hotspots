export type SourceId =
  | "36kr"
  | "autohome"
  | "dongchedi"
  | "sina-auto"
  | "gasgoo"
  | "d1ev"
  | "chedongxi"
  | "ithome"
  | "baidu-hot"
  | "weibo-hot";

export type SourceKind = "api" | "rss" | "html" | "hotlist";

export interface SourceMeta {
  id: SourceId;
  name: string;
  homepage: string;
  kind: SourceKind;
  description: string;
}

export interface NewsItem {
  id: string;
  sourceId: SourceId;
  title: string;
  url: string;
  summary?: string;
  publishedAt: string;
  /** 热搜榜等信源附带的热度值（原始量级不一，仅用于同信源内比较） */
  hotValue?: number;
  /** 分析阶段填充 */
  brands?: string[];
  topics?: string[];
  keywords?: string[];
}

export type SourceStatus = "live" | "mock" | "error";

export interface SourceRunResult {
  sourceId: SourceId;
  name: string;
  homepage: string;
  kind: SourceKind;
  status: SourceStatus;
  itemCount: number;
  durationMs: number;
  fetchedAt: string;
  error?: string;
}

export type Trend = "up" | "down" | "flat";

export interface Hotspot {
  id: string;
  title: string;
  summary: string;
  score: number;
  trend: Trend;
  /** 与上一轮快照相比的热度变化（分） */
  trendDelta: number;
  mentionCount: number;
  sourceCount: number;
  sourceIds: SourceId[];
  brands: string[];
  topics: string[];
  keywords: string[];
  firstSeen: string;
  lastSeen: string;
  recent24h: number;
  items: NewsItem[];
}

export interface TopicStat {
  topic: string;
  count: number;
  share: number;
  hotspotCount: number;
}

export interface BrandStat {
  brand: string;
  count: number;
  sourceCount: number;
  hotspotCount: number;
  topTopics: string[];
}

export interface HotspotsPayload {
  generatedAt: string;
  windowHours: number;
  hotspots: Hotspot[];
  topics: TopicStat[];
  brands: BrandStat[];
  timeline: NewsItem[];
  sources: SourceRunResult[];
  stats: {
    totalItems: number;
    hotspotCount: number;
    liveSources: number;
    mockSources: number;
    items24h: number;
  };
}
