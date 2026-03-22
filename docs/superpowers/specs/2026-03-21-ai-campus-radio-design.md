# AI Campus Radio — 设计文档

> 状态: Draft | 日期: 2026-03-21 | 作者: chalessishas + Claude

## 概述

为 Signal-Map (hdmap.live) 增加 24 小时 AI 电台功能。电台作为地图的"氛围引擎"，根据时段自动切换地图视觉风格、音乐类型和 AI 主播的语气。

## 核心体验

用户打开 hdmap.live → 地图右下角有一个迷你播放器 → 点击播放 → 听到符合当前时段氛围的音乐 → AI 主播偶尔插入串场（活动播报、时段问候）→ 地图色调随时段自然过渡。

**默认静音**，用户主动点击才播放。不打扰核心地图体验。

## 时段系统

时区：**美东时间 (America/New_York)**，即 UNC 所在地。服务端和客户端均以此时区计算时段。

四个时段，每个有独立的视觉 + 音频 + 主播配置：

| 时段 | 时间 (ET) | 地图氛围 | 音乐风格 | 主播情绪 | 串场间隔 |
|------|-----------|----------|----------|----------|----------|
| morning | 7:00-9:00 | 暖橙色调，柔和光照感 | 轻快 acoustic/indie | 开朗、有活力 | 每 2 首歌 |
| daytime | 9:00-17:00 | 正常色调 | 学习向 lofi/ambient | 平稳、轻松 | 每 4 首歌 |
| evening | 17:00-21:00 | 夕阳渐变，暖色偏移 | 社交向 chill/pop | 温暖、友好 | 每 3 首歌 |
| night | 21:00-7:00 | 深色 + 微光效果 | 助眠 ambient/piano | 低沉、舒缓 | 每 6 首歌 |

**时段过渡：** AmbienceEngine 用 JS requestAnimationFrame 在 30 秒内逐步插值 CSS 变量（CSS custom properties 不支持原生 transition）。音乐在当前曲目结束后自然切到新时段队列。

## 架构

```
┌─────────────────────────────────────────────┐
│ 前端 (Next.js Client Components)            │
│                                             │
│  RadioPlayer (浮动播放器 UI)                │
│    ├─ 播放/暂停、音量、当前曲目显示         │
│    └─ 时段指示器                            │
│                                             │
│  AmbienceEngine (氛围引擎)                  │
│    └─ JS 插值切换 CSS 变量（30s 渐变）      │
│                                             │
│  HTML5 Audio                                │
│    └─ 按队列播放：音乐 → 串场语音 → 音乐   │
└──────────────────┬──────────────────────────┘
                   │ fetch
┌──────────────────▼──────────────────────────┐
│ 后端 API Routes (Next.js)                   │
│                                             │
│  /api/radio/playlist                        │
│    └─ 从 manifest.json 返回当前时段曲目     │
│                                             │
│  /api/radio/announce                        │
│    ├─ 1. 查询即将发生的活动 (Prisma)        │
│    ├─ 2. DeepSeek 生成串场文案              │
│    └─ 3. ElevenLabs TTS 合成语音            │
│       └─ 返回 base64 音频                   │
│                                             │
│  串场预生成 (cron / revalidate)             │
│    └─ 每 15 分钟预生成下一段串场并缓存      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 音乐存储                                    │
│                                             │
│  /public/radio/manifest.json (曲目索引)     │
│  /public/radio/{period}/*.mp3 (MVP 本地)    │
│  → 后续迁移到 Supabase Storage / R2        │
└─────────────────────────────────────────────┘
```

## 组件设计

### 1. RadioPlayer (前端)

新建 `/src/components/radio-player.tsx`，"use client"。

**UI 元素：**
- 固定在地图右下角的胶囊形播放器
- 播放/暂停按钮 + 音量滑块
- 当前曲目名称（滚动文字）
- 时段图标（太阳/月亮等）
- 展开态（点击胶囊展开）：曲目列表、主播最近串场文字

**移动端：** 胶囊缩小为圆形按钮（仅播放/暂停图标），展开态为底部半屏 sheet。位置避开 Leaflet 缩放控件。

**状态管理：**
- isPlaying, volume, currentTrack, currentPeriod
- audioQueue: Track[] — 音乐和串场语音交替排列
- 用 useRef 持有 HTMLAudioElement

**播放逻辑：**
1. 用户点击播放 → 判断当前时段（ET 时区）
2. fetch `/api/radio/playlist?period={period}` 获取音乐队列
3. 按队列顺序播放，队列耗尽后循环（shuffle 重新排序）
4. 每 N 首歌后（N 由时段决定，见上表）fetch `/api/radio/announce` 插入串场
5. 串场播完继续音乐
6. 时段切换：等当前曲目播完 → fade out (1s) → 加载新时段队列 → fade in (1s)

**浏览器自动播放：** 仅在用户首次点击播放按钮后激活 AudioContext。页面导航/tab 切换后不自动恢复，用户需再次点击。

### 2. AmbienceEngine (前端)

新建 `/src/components/ambience-engine.tsx`，"use client"。

**职责：** 根据时段修改 CSS 变量，改变地图整体视觉。

**实现：**
- useEffect 每分钟检查当前时段（ET 时区）
- 时段变化时用 requestAnimationFrame 在 30s 内线性插值 CSS 变量颜色值
- 变量包括：--bg, --panel-bg, --accent, --heat-0~4
- 地图瓦片层加 CSS filter

**CSS filter 映射：**
```css
[data-period="morning"] .leaflet-tile-pane { filter: saturate(1.1) hue-rotate(-10deg); }
[data-period="daytime"] .leaflet-tile-pane { filter: none; }
[data-period="evening"] .leaflet-tile-pane { filter: saturate(1.2) hue-rotate(15deg) brightness(0.95); }
[data-period="night"]   .leaflet-tile-pane { filter: brightness(0.7) saturate(0.8); }
```

**SSR 防闪烁：** page.tsx 在服务端根据当前 ET 时间计算时段，将 `data-period` 作为 prop 传入，初始 HTML 即包含正确的时段属性。

### 3. /api/radio/playlist (后端)

**输入：** `?period=morning|daytime|evening|night`

**逻辑：**
1. 读取 `/public/radio/manifest.json`（构建时生成的曲目索引）
2. 过滤出对应时段的曲目
3. 随机打乱顺序
4. 返回 `{ tracks: [{ title, artist, url, duration }] }`

**manifest.json 格式：**
```json
{
  "morning": [
    { "title": "Sunrise Walk", "artist": "CC Artist", "file": "morning/sunrise-walk.mp3", "duration": 180 }
  ],
  "daytime": [...],
  "evening": [...],
  "night": [...]
}
```

构建时由 `scripts/build-radio-manifest.ts` 扫描 `/public/radio/` 目录生成，避免运行时 fs 操作（Serverless 兼容）。

### 4. /api/radio/announce (后端)

**输入：** `?period=morning&lastTrack=xxx&nextTrack=yyy`

**串场预生成策略：** 为避免用户等待 API 延迟（DeepSeek ~2s + ElevenLabs ~3s），采用预生成：
- 利用 Next.js `revalidate = 900`（15 分钟），服务端在后台预生成串场
- 客户端 fetch 时命中缓存，无延迟
- 缓存 key: `{period}-{hour}`，同一小时内返回同一段串场

**生成逻辑：**
1. 查询 Prisma：当前时间起 3 小时内的活动，按 startTime 升序取前 3 个
2. 构造 DeepSeek prompt：
   ```
   你是 UNC Chapel Hill 校园电台的主播。现在是 {time} ET，{period} 时段。
   语气要求：{emotion_for_period}
   当前活动：{events_summary}
   生成一段 2-3 句的英文串场词，自然、简短、有人味。不超过 80 个英文单词。
   ```
3. DeepSeek 返回文案（~50-80 words）
4. 调用 ElevenLabs API：voice_id + 文案 + stability/similarity 参数控制情绪
5. 返回 `{ audio: "base64...", text: "串场文案", period: "morning" }`

**ElevenLabs 成本控制：**
- 每次串场 ~80 words ≈ 400 字符
- 每小时预生成 4 次 = 1,600 字符/小时
- 每天 ≈ 38,400 字符
- ElevenLabs Starter plan ($5/月, 30,000 字符) 基本够用；超出后降级为纯文字显示
- 降级策略：ElevenLabs 返回 429/402 时，跳过 TTS，前端仅显示文字串场词

## 音乐曲库管理

### 初期方案（MVP）
- 每个时段准备 10-15 首曲子（共 40-60 首）
- 来源：Free Music Archive (CC-BY / CC0) + Suno AI 生成
- 存放在 `/public/radio/{period}/` 下
- 格式：MP3 128kbps（兼容所有浏览器，单文件 ~3-5MB）
- 总体积 ~150-250MB，MVP 阶段可接受

### CC 版权标注
- CC-BY 曲目需要在播放器展开态显示 attribution（曲目名 + 作者）
- CC0 曲目无需标注
- AI 生成曲目标注 "AI Generated"

### 后续迁移
- 音乐文件迁移到 Supabase Storage 或 Cloudflare R2
- 数据库管理曲目元数据
- manifest.json 改为 API 动态生成

## 环境变量新增

| 变量名 | 用途 | 获取方式 |
|--------|------|----------|
| `DEEPSEEK_API_KEY` | 生成串场文案 | DeepSeek 控制台 |
| `ELEVENLABS_API_KEY` | TTS 语音合成 | ElevenLabs 控制台 |
| `ELEVENLABS_VOICE_ID` | 主播声音 ID | ElevenLabs 创建声音后获取 |

## 数据库变更

无。电台功能复用现有 Event 表查询活动数据，不需要新表。

曲目管理 MVP 阶段用 manifest.json + 文件系统，不入库。

## 错误处理

- DeepSeek API 失败 → 跳过串场，继续播音乐
- ElevenLabs API 失败/超额 → 用纯文字在播放器上显示串场词（无语音）
- ElevenLabs 返回 429/402 → 本次及后续 1 小时内跳过 TTS 调用
- 音乐文件加载失败 → 跳到下一首
- playlist API 初始加载失败 → 播放器显示"电台暂时不可用"，提供重试按钮
- 已获取队列后网络中断 → 继续播放已加载的队列，恢复后自动 fetch 新内容

## 文件清单

新建：
- `src/components/radio-player.tsx` — 播放器 UI + 音频控制逻辑
- `src/components/ambience-engine.tsx` — 时段氛围 CSS 变量插值切换
- `src/app/api/radio/playlist/route.ts` — 曲目列表 API
- `src/app/api/radio/announce/route.ts` — AI 串场预生成 API
- `src/lib/radio.ts` — 时段判断(ET)、DeepSeek/ElevenLabs 调用封装
- `scripts/build-radio-manifest.ts` — 构建时生成 manifest.json
- `public/radio/manifest.json` — 曲目索引（构建时生成）
- `public/radio/{morning,daytime,evening,night}/` — 音乐文件目录

修改：
- `src/app/globals.css` — 新增时段 CSS filter + 播放器样式
- `src/app/page.tsx` — 服务端计算时段，引入 AmbienceEngine + 传 data-period
- `src/components/map-panel.tsx` — 引入 RadioPlayer
- `.env` — 新增 3 个环境变量
- `package.json` — 新增 build:radio-manifest 脚本
