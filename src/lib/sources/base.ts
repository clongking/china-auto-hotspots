import type { NewsItem, SourceId, SourceMeta } from "@/lib/types";

export interface SourceAdapter extends SourceMeta {
  /** 抓取并归一化为 NewsItem；失败时抛错，由上层回退到 mock */
  fetch(): Promise<NewsItem[]>;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

/** 网络层错误（连接超时、DNS 等）重试一次；HTTP 4xx/5xx 不重试 */
const NETWORK_RETRIES = 1;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      return await fetchOnce(url, init, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (err instanceof HttpError) throw err;
    }
  }
  throw lastErr;
}

export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}

async function fetchOnce(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new HttpError(res.status);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(
  url: string,
  options: { encoding?: string; init?: RequestInit; timeoutMs?: number } = {},
): Promise<string> {
  const res = await fetchWithTimeout(url, options.init, options.timeoutMs);
  if (options.encoding) {
    const buf = await res.arrayBuffer();
    return new TextDecoder(options.encoding).decode(buf);
  }
  return res.text();
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<T> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  return (await res.json()) as T;
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&hellip;": "…",
  "&mdash;": "—",
  "&middot;": "·",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&[a-z]+;/gi, (m) => ENTITY_MAP[m.toLowerCase()] ?? m);
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanTitle(raw: string): string {
  return stripTags(raw).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** 解析中文相对时间（“刚刚”“23分钟前”“3小时前”“2天前”）或绝对时间 */
export function parseChineseTime(text: string, now = new Date()): Date | null {
  const t = text.trim();
  if (!t) return null;
  if (/刚刚|刚才|just now/i.test(t)) return now;
  let m = t.match(/(\d+)\s*分钟前/);
  if (m) return new Date(now.getTime() - Number(m[1]) * 60_000);
  m = t.match(/(\d+)\s*小时前/);
  if (m) return new Date(now.getTime() - Number(m[1]) * 3_600_000);
  m = t.match(/(\d+)\s*天前/);
  if (m) return new Date(now.getTime() - Number(m[1]) * 86_400_000);
  if (/^昨天/.test(t)) {
    const hm = t.match(/(\d{1,2}):(\d{2})/);
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    if (hm) d.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
    return d;
  }
  m = t.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      m[4] ? Number(m[4]) : 9,
      m[5] ? Number(m[5]) : 0,
    );
  }
  m = t.match(/^(\d{1,2})[-/月](\d{1,2})(?:日)?(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    return new Date(
      now.getFullYear(),
      Number(m[1]) - 1,
      Number(m[2]),
      m[3] ? Number(m[3]) : 9,
      m[4] ? Number(m[4]) : 0,
    );
  }
  const abs = new Date(t);
  return Number.isNaN(abs.getTime()) ? null : abs;
}

/** 从 URL 中的日期片段推断时间，如 /2026-09-25/ 或 /202609/ */
export function dateFromUrl(url: string, now = new Date()): Date | null {
  let m = url.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0);
  m = url.match(/\/(20\d{2})(\d{2})(\d{2})\//);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0);
  m = url.match(/\/(20\d{2})(\d{2})\//);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1, 12, 0);
    return d > now ? now : d;
  }
  return null;
}

export function makeItemId(sourceId: SourceId, key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return `${sourceId}-${(h >>> 0).toString(36)}`;
}

/** 泛信源（36氪、热搜榜等）用于筛选汽车相关条目的关键词 */
const AUTO_HINTS = [
  "汽车", "车企", "车型", "新车", "电动车", "新能源车", "新能源汽车", "乘用车", "商用车", "整车", "车展",
  "智驾", "智能驾驶", "自动驾驶", "辅助驾驶", "Robotaxi", "激光雷达", "车机", "座舱",
  "比亚迪", "特斯拉", "蔚来", "小鹏", "理想", "零跑", "小米汽车", "小米SU7", "小米YU7", "SU7", "YU7",
  "问界", "尊界", "享界", "智界", "尚界", "奕境", "鸿蒙智行", "吉利", "极氪", "领克", "长城", "哈弗",
  "长安", "深蓝", "阿维塔", "启源", "奇瑞", "捷途", "广汽", "埃安", "上汽", "智己", "一汽", "红旗",
  "东风", "岚图", "北汽", "极狐", "大众", "丰田", "本田", "日产", "宝马", "奔驰", "奥迪", "保时捷",
  "沃尔沃", "现代", "起亚", "通用汽车", "福特", "Stellantis", "哪吒", "极越", "高合", "宁德时代",
  "动力电池", "固态电池", "充电桩", "换电", "续航", "召回", "价格战", "购置税", "以旧换新",
  "Model Y", "Model 3", "Cybertruck", "FSD", "L3", "NOA", "车路云", "整车厂", "主机厂", "经销商",
  "4S店", "上市即交付", "大定", "交付量", "月销", "周销量", "上险量", "乘联会", "中汽协",
];

function countHints(text: string): number {
  const t = text.toLowerCase();
  return AUTO_HINTS.filter((k) => t.includes(k.toLowerCase())).length;
}

/** 标题命中任一关键词，或摘要命中 ≥2 个关键词，视为汽车相关 */
export function isAutoRelated(title: string, summary?: string): boolean {
  if (countHints(title) > 0) return true;
  return summary ? countHints(summary) >= 2 : false;
}

export function dedupeByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const key = it.url.split("#")[0].split("?")[0];
    if (seen.has(key) || seen.has(it.title)) continue;
    seen.add(key);
    seen.add(it.title);
    out.push(it);
  }
  return out;
}

export function extractAnchors(
  html: string,
  hrefPattern: RegExp,
): Array<{ href: string; text: string; tag: string }> {
  const out: Array<{ href: string; text: string; tag: string }> = [];
  const re = /<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[2];
    if (!hrefPattern.test(href)) continue;
    const attrs = `${m[1]} ${m[3]}`;
    const titleAttr = attrs.match(/title="([^"]+)"/)?.[1];
    const inner = cleanTitle(m[4]);
    const text = inner || (titleAttr ? cleanTitle(titleAttr) : "");
    out.push({ href, text, tag: m[0] });
  }
  return out;
}
