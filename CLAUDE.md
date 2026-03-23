# Signal-Map (hdmap.live)

UNC Chapel Hill 校园实时活动地图。聚合 5 个事件数据源，覆盖 86 栋建筑（1,236 GeoJSON polygons），展示 T0-T4 热力等级，支持用户事件提交、嵌套评论、CLE 学分追踪、校园电台。

## Tech Stack

- **Framework:** Next.js 15 + React 19 + TypeScript
- **ORM:** Prisma 6.4.1
- **DB:** Supabase (PostgreSQL), session pooler on port 5432
- **Map:** Leaflet 1.9.4 + react-leaflet (CARTO Voyager tiles)
- **Auth:** Supabase SSR (@supabase/ssr)
- **Validation:** Zod 3.24.2
- **Fonts:** Crimson Pro (headings), Inter (body)
- **Deploy:** Vercel → hdmap.live

## Architecture

```
src/app/layout.tsx (Root Layout)
  ├─ /                    SSR 主页: 地图 + 侧边栏
  │   ├─ AmbienceEngine   时段背景
  │   ├─ EventSidebar     左侧面板（统计、搜索、事件提交）
  │   └─ MapPanel          Leaflet 地图 + 事件详情
  ├─ /building/[id]       建筑详情页
  ├─ /auth/callback       Supabase OAuth 回调
  └─ /auth/error          认证错误页

API Routes (10):
  /api/events             GET: 建筑事件 (now + upcoming)
  /api/events/submit      POST: 用户提交事件（需认证）
  /api/events/user        GET: 当前用户事件
  /api/buildings          GET: 所有建筑（SSR 已加载，很少直接调用）
  /api/categories         GET: 事件分类
  /api/comments           POST/GET: 嵌套评论
  /api/cron/ingest        GET: 全量数据采集（需 ADMIN_TOKEN）
  /api/admin/re-ingest/[sourceId]  单源重新采集
  /api/radio/playlist     GET: 时段音乐播放列表
  /api/radio/announce     GET: AI 播报（DeepSeek API）
```

## Directory Structure

```
src/
  app/           页面 + API 路由
  components/    14 个 .tsx 组件（MapPanel, EventSidebar, SearchPanel, etc.）
  lib/
    prisma.ts          PrismaClient 单例
    types.ts           HeatLevel, BuildingSummary, EventSummary
    events.ts          热力计算 + 事件窗口查询
    radio.ts           时段检测 + 播放列表 + DeepSeek 调用
    ingest/
      service.ts       ingestSource, ingestAllSources
      normalizer.ts    模糊匹配建筑（缩写前缀 → token 重叠 → Haversine）
      freshness.ts     >1h 新鲜度检查
      *-parser.ts      5 个 parser（heellife, unc-calendar, cpa, ical x2）
    supabase/
      client.ts        createSupabaseBrowser
      server.ts        createServiceRoleClient
prisma/
  schema.prisma    7 个模型: Building, Event, EventSource, IngestLog, UserProfile, UserEvent, Comment
public/            GeoJSON + 静态资源
```

## Data Flow

1. **SSR 主页加载:** prisma.building.findMany() → computeBuildingHeatLevels() → 渲染地图
2. **用户点击建筑:** MapPanel → /api/events?buildingId=X → 展示事件详情
3. **后台采集（每小时/手动）:** /api/cron/ingest → 5 parser 并行 → normalizeEvents() 模糊匹配建筑 → Upsert Event 表

## Key Patterns

- **热力等级 T0-T4:** 灰/绿/黄/橙/红 + CSS 呼吸光动画
- **CLE 标识:** 蓝色 #339af0 + 光晕 + 虚线边框
- **事件去重:** sourceId 唯一约束，ingest 时 upsert
- **建筑匹配:** 缩写前缀 → 60%+ token 重叠 → Haversine <500m → null fallback
- **Ingest 保护:** 55s 超时，fire-and-forget，每源独立错误隔离
- **毛玻璃面板:** backdrop-filter: blur(20px)
- **暗色模式:** CSS variables 切换

## DB Indexes

- Events: `buildingId + startTime + status + category`
- UserEvents: `authorId + buildingId + status`
- Comments: `eventId + buildingId + authorId`

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Supabase session pooler (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | |
| `ADMIN_TOKEN` | Yes (prod) | 管理端点认证 |
| `CRON_SECRET` | Optional | Vercel Cron |
| `DEEPSEEK_API_KEY` | Yes if radio | AI 播报 |

## Known Pitfalls

1. **`ignoreBuildErrors: true` in next.config.ts** -- 最大技术债，隐藏所有 TS 错误
2. **Supabase direct URL 不可用** -- 只能用 session pooler (port 5432)，不要用 directUrl/port 6543
3. **Transaction pooler 会挂起 Prisma** -- 必须用 session pooler
4. **Leaflet + React Strict Mode** -- 双重初始化，需 cleanup 逻辑
5. **建筑匹配率 74%** -- 26% 事件无法关联建筑
6. **Prisma seed 配置将废弃** -- 未来需迁移到 prisma.config.ts
7. **Vercel Cron 未配置** -- vercel.json 未设置，仅手动触发 ingest
8. **移动端未优化** -- 布局假设桌面视口
9. **无自动化测试** -- API、ingest pipeline、normalizer 均无覆盖
10. **用 `db push` 而非 `prisma migrate`** -- 生产环境应切换
