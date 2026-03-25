# Signal-Map — 进度交接书

## 项目概述
UNC Chapel Hill 校园实时活动地图，聚合 5 个校内数据源，在交互式地图上展示 86 栋建筑的事件热力等级。

## 当前状态
已部署上线，运行在 hdmap.live。校园 AI 电台功能已完成本地验证（DeepSeek 文案 + DashScope TTS + 20 首 CC0 音乐），待 Vercel 环境变量配置后即可上线。

## 技术栈
Next.js 15 + React 19 + TypeScript + Leaflet (CARTO Voyager) + Prisma + PostgreSQL (Supabase)

## 部署信息
- 线上地址：hdmap.live
- 托管平台：待确认（Next.js 部署，可能是 Vercel）
- 数据库：Supabase PostgreSQL（项目 ref: `cxdgxavccjuztrwsyhdq`，us-east-1）
- 仓库：https://github.com/chalessishas/Signal-Map
- 主分支：`main`

## 环境变量清单
| 变量名 | 用途 | 获取方式 |
|--------|------|----------|
| `DATABASE_URL` | Supabase 连接池（session mode, 端口 5432） | Supabase Dashboard → Connect |
| `DIRECT_URL` | Supabase 直连（用于 migration） | 同上 |
| `ADMIN_TOKEN` | 保护 /api/cron/ingest 端点 | 自定义 |
| `CRON_SECRET` | Vercel Cron 验证（可选） | Vercel Dashboard |
| `DEEPSEEK_API_KEY` | AI 播报文案生成 | DeepSeek 控制台 |
| `DASHSCOPE_API_KEY` | 语音合成（qwen3-tts-flash） | 阿里云 DashScope 控制台 |

注意：Prisma 需要 session mode pooler（端口 5432），transaction mode（6543）会卡住。

## 架构 / 数据流
```
用户打开地图 → page.tsx (Server Component)
  ├→ 检查数据新鲜度（>1h 则后台触发 ingest）
  ├→ prisma.building.findMany() 获取建筑
  ├→ computeBuildingHeatLevels() 计算热力等级 (T0-T4)
  └→ 渲染 <MapPanel> (Leaflet 客户端组件)

用户点击建筑 → /api/events?buildingId={id}
  └→ 返回 happening now + upcoming 事件列表

后台 ingest（每小时）→ /api/cron/ingest
  ├→ 5 个解析器: Heel Life / UNC Calendar / Libraries / Athletics / CPA
  ├→ normalizeEvents() 匹配建筑（名称 + 坐标 + 模糊匹配）
  └→ 写入/更新 Event 表，标记消失的事件为 CANCELLED
```

## 已完成
- [100%] 交互式地图 + 1,236 栋建筑 GeoJSON 多边形
- [100%] 热力等级系统 (T0-T4) + 呼吸发光动画
- [100%] CLE 学分事件追踪（蓝色虚线边框）
- [100%] 建筑搜索（模糊匹配名称 + 别名）
- [100%] 5 个数据源解析器（580+ 事件，74% 匹配到建筑）
- [100%] 自动刷新（每小时 ingest + 页面 60s revalidate）
- [100%] 事件去重 + 过期事件清理
- [100%] Admin Dashboard（系统概览 + 手动 re-ingest）
- [100%] Vercel Cron 每小时自动 ingest
- [100%] 校园 AI 电台（DeepSeek 文案 + DashScope TTS + 20 首 CC0 音乐 + 4 时段切换）

## 进行中 / 待完成
- [90%] 电台上线（本地验证通过，需配 Vercel 环境变量 DEEPSEEK_API_KEY + DASHSCOPE_API_KEY）
- [0%] 移动端优化
- [0%] 课程表集成（找同学功能）
- [0%] 任务市场（南北校区跑腿）
- [0%] CLE 事件推送通知

## 关键决策记录
| 日期 | 决策 | 原因 |
|------|------|------|
| - | 用 CARTO Voyager 瓦片替代 Google Maps | 免费，不需要 API key |
| - | Supabase PostgreSQL 而非 SQLite | 支持多用户并发 + 云端持久化 |
| - | Server Components 渲染首屏地图 | SEO + 减少客户端 JS 体积 |
| 2026-03-21 | 移除 schema.prisma 中的 directUrl | Direct 端口 DNS 解析失败，用 session pooler 替代 |
| 2026-03-24 | TTS 从 ElevenLabs 切换为阿里 DashScope qwen3-tts-flash | ElevenLabs 免费额度少 + 贵；DashScope 几乎免费 |
| 2026-03-24 | DashScope 用国内端点 + SSE 模式获取 base64 | 国际端点 key 无效；非 SSE 返回的 OSS URL 在美国 403 |

## 已知问题
- directUrl (db.*.supabase.co:5432) 连不上，已临时从 schema 移除
- 端口 3000 可能被占用，dev 模式会自动切到其他端口
- `package.json#prisma` 配置方式已 deprecated，Prisma 7 需迁移到 prisma.config.ts

## 快速上手
```bash
git clone https://github.com/chalessishas/Signal-Map.git
cd Signal-Map
cp .env.example .env   # 填入 Supabase 连接字符串
npm install
npx prisma db push     # 同步 schema 到数据库
npm run dev             # 默认 localhost:3000
```
