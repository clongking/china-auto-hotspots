# 中国汽车行业热点事件监控系统

聚合多个中国汽车行业公开信源，自动提取中文关键词与实体（车企、车型、政策、价格战、新能源、智驾、出海、召回等），把资讯聚类为「热点事件」并计算热度分与趋势，以仪表盘形式展示当前行业最关心的话题。

技术栈：Next.js 16（App Router）+ TypeScript + Tailwind CSS v4 + shadcn/ui。不依赖数据库与登录，数据缓存在内存和本地 JSON 文件中。

## 功能

- **热点事件排行榜**：热度分、趋势（上升 / 下降 / 持平）、提及次数、覆盖信源数、涉及品牌与话题、关联新闻链接
- **话题分类分布**：价格战 / 新能源 / 智驾 / 出海 / 召回 / 政策 / 新车上市 / 销量交付 / 资本经营 / 供应链技术
- **热门品牌 / 车企榜**：按被提及条数排序，含跨信源数与主要话题
- **近期时间线**：各信源最新资讯按发布时间倒序，可分页加载
- **按信源筛选**：多选信源后，排行榜、话题分布、品牌榜、时间线同步重算
- **手动刷新与最近更新时间**：一键重新抓取全部信源；服务端缓存过期时自动后台刷新
- **信源状态面板**：实时显示每个信源是在线抓取还是回退到示例数据，并给出失败原因
- 处理了 loading / 空 / 错误状态与移动端布局

## 信源列表

每个信源对应 `src/lib/sources/` 下一个 adapter，统一实现 `SourceAdapter` 接口（`fetch(): Promise<NewsItem[]>`），在 `src/lib/sources/index.ts` 注册即可扩展。

| 信源 | 类型 | 接入方式 |
| --- | --- | --- |
| 36氪汽车 | API | 36氪开放网关：快讯流 + 热榜 + 站内搜索“汽车”，按汽车关键词过滤 |
| 汽车之家 | HTML | 资讯“全部”频道页（GB2312 编码），解析标题、摘要与相对时间 |
| 懂车帝 | API | 车型关注度榜与销量榜 JSON 接口，转为“车型热度”条目 |
| 新浪汽车 | HTML | 首页与新闻频道页，提取 `detail-*.shtml` 文章链接（日期取自 URL） |
| 盖世汽车 | HTML | 资讯首页，提取 `/news/YYYYMM/*.shtml` 文章链接 |
| 第一电动 | HTML | 新闻列表页，提取 `/news/{栏目}/{id}` 链接 |
| 车东西 | API | WordPress REST API（`/wp-json/wp/v2/posts`） |
| IT之家·车 | RSS | 全站 RSS，仅保留汽车相关条目 |
| 百度热搜 | Hotlist | 实时榜（过滤汽车相关词条）+ 汽车热榜（车系热搜指数）JSON 接口 |
| 微博热搜 | Hotlist | 热搜榜接口（`weibo.com/ajax/statuses/hot_band`，需带 Referer），保留分类为“汽车”或命中汽车关键词的词条 |

### 失败回退（mock）

任一信源抓取抛错、超时（20s）或解析结果少于 3 条（热搜榜类少于 1 条）时，会自动使用 `src/lib/mock/index.ts` 中该信源的内置示例数据，并在信源状态面板中标注为「示例数据」及原因。示例数据刻意在多个信源间覆盖相同事件，因此即便完全离线（`HOTSPOTS_OFFLINE=1`），仪表盘也能展示跨信源聚类的效果，页面不会空白或报错。

## 热点探测与热度算法

代码位于 `src/lib/analysis/`。

1. **实体与话题提取**（`dictionary.ts`、`extract.ts`）
   - 品牌词典：规范名 + 别名 + 归属车型（如「海鸥」→ 比亚迪，「YU7」→ 小米汽车，「问界 / 尊界 / 余承东」→ 鸿蒙智行）。短的字母数字型代号（M8、L6）做边界匹配，被多个品牌共用的代号不用于归属判断。
   - 话题词典：10 个话题各带一组关键词，标题或摘要命中即打标。
   - 语料热词：把所有标题去掉实体词与停用词后切成 2~4 字中文片段，二字片段需出现在 ≥3 条标题、三四字片段 ≥2 条，且不超过语料的 8%（过滤模板词），并做长片段优先去重。
2. **聚类为热点事件**（`index.ts`）
   - 每条资讯的特征 = 品牌 + 车型 + 热词（强特征）与话题（弱特征）。
   - 按特征数量与新鲜度排序后贪心归簇：与某簇的相似度 = Σ 共同强特征权重 × 该特征在簇内的出现比例 + Σ 共同话题权重 × 比例，≥ 1.5 即并入；品牌 / 车型权重 1.0，热词 0.8，具体话题（价格战、召回、出海、政策、资本经营、智驾）0.6，泛话题（新车上市、销量交付等）0.2。
   - 无共同实体时仅在标题二元组 Jaccard ≥ 0.32 时合并；晨报 / 快讯合集类条目不参与聚类；榜单模板条目不走标题相似度兜底。
3. **热度分**（0~100，相对当批数据归一化）

   ```
   热度 = 0.30 × log2(1 + 提及次数) / max
        + 0.30 × 跨信源数 / max
        + 0.30 × Σ exp(-发布距今小时数 / 24) / max     # 时间新鲜度
        + 0.10 × Σ 热榜归一化热度值 / max              # 仅热榜类信源提供
   ```

   没有热榜数据时前两项各加 0.05。只有提及 ≥2 次或覆盖 ≥2 个信源的簇才算热点事件，不足 8 个时用高分单条补足，最多展示 40 个。
4. **趋势**
   - 与上一轮快照（同 item 归属的簇）比较热度分，|Δ| ≥ 5 判定上升 / 下降；
   - 否则按速度判断：24 小时内条数 ≥2 且多于 24~72 小时区间为上升，24 小时内为 0 而更早有为下降，其余持平。

统计窗口为最近 7 天。

## API

| 路径 | 说明 |
| --- | --- |
| `GET /api/hotspots` | 返回缓存的热点数据；缓存超过 TTL（默认 15 分钟，`HOTSPOTS_TTL_MINUTES`）时先返回旧数据并后台刷新。`?refresh=1` 强制重新抓取 |
| `POST /api/refresh`（也支持 GET） | 立即重新抓取全部信源并重算，返回各信源状态与耗时。`?mock=1` 强制使用示例数据 |

缓存写入 `.cache/hotspots.json`（已在 `.gitignore` 中），进程重启后可直接复用并用于趋势对比。定时刷新可用系统 cron 或任意调度器定期调用 `/api/refresh`。

返回结构见 `src/lib/types.ts` 中的 `HotspotsPayload`。

## 本地运行

```bash
npm install
npm run dev        # http://localhost:43117
```

其它命令：

```bash
npm run build && npm start   # 生产模式，同样监听 43117
npm run lint
npm run snapshot                 # 抓取并生成 public/data/hotspots.json（静态部署用）
HOTSPOTS_OFFLINE=1 npm run dev   # 完全离线，全部信源使用示例数据
```

首次打开页面会抓取全部信源（约 5~15 秒，取决于网络），之后走缓存。

## 部署到 GitHub Pages（静态版）

仓库自带 `.github/workflows/pages.yml`：推送到 `main`、每小时定时（cron）或手动触发时，GitHub Actions 会

1. `npm run snapshot`：在 CI 中抓取全部信源并分析，写入 `public/data/hotspots.json`（会读取上一次已发布的快照来计算趋势）；
2. 移除 `src/app/api`（静态导出不支持 API Route），以 `NEXT_PUBLIC_STATIC_MODE=1` 和 `NEXT_PUBLIC_BASE_PATH=/<仓库名>` 执行 `next build` 生成 `out/`；
3. 用 `peaceiris/actions-gh-pages` 把 `out/` 推送到 `gh-pages` 分支，由 GitHub Pages（Source: `gh-pages` / root）托管。

静态版前端直接读取快照 JSON，「手动刷新」按钮变为「重新加载」（只拉取最新快照），页面上会标注数据由 GitHub Actions 定时更新。公开仓库首次出现 `gh-pages` 分支时 GitHub 会自动启用 Pages，无需 Pages API 管理权限；若未自动启用，可在 Settings → Pages 中把 Source 设为 `gh-pages` 分支。

本地模拟静态构建：

```bash
npm run snapshot
mv src/app/api /tmp/api-bak && NEXT_PUBLIC_STATIC_MODE=1 NEXT_PUBLIC_BASE_PATH=/china-auto-hotspots npx next build; mv /tmp/api-bak src/app/api
```

## 目录结构

```
scripts/build-snapshot.mts   生成静态数据快照（GitHub Pages 用）
.github/workflows/pages.yml  定时抓取 + 静态导出 + 发布到 Pages
src/
  app/
    api/hotspots/route.ts   读取热点数据
    api/refresh/route.ts    手动 / 定时刷新
    page.tsx, layout.tsx
  components/dashboard/     仪表盘（排行榜卡片、侧栏面板、时间线、数据 hook）
  components/ui/            shadcn/ui 组件
  lib/
    sources/                信源适配器（每个信源一个文件）+ 注册与回退逻辑
    mock/                   各信源示例数据
    analysis/               词典、实体 / 热词提取、聚类与热度计算
    store.ts                内存 + JSON 文件缓存
    types.ts, format.ts
```

## 新增信源

1. 在 `src/lib/sources/` 新建 `xxx.ts`，导出实现 `SourceAdapter` 的对象（`id`、`name`、`homepage`、`kind`、`description`、`fetch`）。
2. 在 `src/lib/types.ts` 的 `SourceId` 联合类型中加入新 id，并在 `src/lib/format.ts` 中补充中文名。
3. 在 `src/lib/mock/index.ts` 为该信源补几条示例数据。
4. 在 `src/lib/sources/index.ts` 的 `SOURCE_ADAPTERS` 数组中注册。

## 说明

数据均来自各信源公开页面与接口，仅用于行业动态监测与演示。信源页面结构或接口变化会导致对应 adapter 失效，此时系统会自动回退到示例数据并在界面中标注。
