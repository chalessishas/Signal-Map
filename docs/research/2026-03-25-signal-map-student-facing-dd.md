# Signal-Map 深度调研 Memo

日期：2026-03-25  
对象：面向学生用户的对外故事与产品优先级  
结论先行：Signal-Map 现在最可信的定义，不是“活动工具”也不是“AI 电台”，而是“学生最快看到此刻此地有什么值得去的校园本地信息网络”。这个故事已经有产品基础，但还不能夸成“完整实时层”或“成熟社交网络”。

## 研究方法

- 仓库核验：通读 [README.md](../../README.md)、[STATUS.md](../../STATUS.md)、[CLAUDE.md](../../CLAUDE.md)、radio 设计文档，以及首页、地图、评论、投稿、admin、ingest、radio 相关源码。
- 线上冒烟：2026-03-25 检查了 [hdmap.live](https://hdmap.live/)、[`/api/radio/playlist?period=morning`](https://hdmap.live/api/radio/playlist?period=morning)、[`/api/radio/announce?period=morning`](https://hdmap.live/api/radio/announce?period=morning)。
- 外部资料：只用了官方或高可信来源，优先 UNC 官方站点、官方 App Store 页面、官方产品页。

## 快速回答

- 它是什么：一个把分散在 Heel Life、官方日历、校园项目页、聊天群和线下海报里的“校园信号”聚合到地图上的校园本地信息网络。
- 学生为什么会重复打开：因为“我现在附近有什么”“今晚还有什么能去”“这个楼/这个场子最近发生什么”这些问题天然高频，而且现有替代品是碎片化的。
- 它比现有替代方案强在哪里：不是单点内容更强，而是把“位置 + 时间 + 多源聚合 + 轻社区层”放到一个入口里。
- 它距离“可大讲特讲”还差哪几步：数据新鲜度、建筑匹配率、移动端体验、首屏信噪比、社区密度。

## 1. 当前产品真相

Signal-Map 已经是一个真实可用的产品，而不只是 demo。它的当前能力有明确代码与线上行为支撑：

- 首页是 SSR 地图入口，会在数据超过 1 小时不新鲜时尝试触发后台刷新，并把建筑热度、活动侧栏、环境音/电台一起挂到主体验上。证据见 [src/app/page.tsx](../../src/app/page.tsx) 和 [src/lib/ingest/freshness.ts](../../src/lib/ingest/freshness.ts)。
- 活动数据来自 5 类 parser，统一归一化并写入事件表。证据见 [src/lib/ingest/service.ts](../../src/lib/ingest/service.ts)。
- 建筑归一化已有缩写、模糊匹配、坐标最近邻三层策略，但官方文档仍写明“580+ events, 74% matched to buildings”。证据见 [README.md](../../README.md)、[STATUS.md](../../STATUS.md)、[src/lib/ingest/normalizer.ts](../../src/lib/ingest/normalizer.ts)。
- 用户可以提交活动，服务端按 `PENDING` 审核流接收；被批准的用户活动会单独出现在侧栏。证据见 [src/components/submit-event-form.tsx](../../src/components/submit-event-form.tsx)、[src/app/api/events/submit/route.ts](../../src/app/api/events/submit/route.ts)、[src/app/api/events/user/route.ts](../../src/app/api/events/user/route.ts)。
- 楼宇页面和活动/楼宇评论都已存在，说明产品不只是“看事件”，而是在尝试给地点加上下文。证据见 [src/app/building/[id]/page.tsx](../../src/app/building/[id]/page.tsx)、[src/components/comment-section.tsx](../../src/components/comment-section.tsx)、[src/app/api/comments/route.ts](../../src/app/api/comments/route.ts)。
- 管理后台和重采集接口已存在，说明项目已进入“要运营、要观测”的阶段。证据见 [src/app/admin/page.tsx](../../src/app/admin/page.tsx)、[src/app/api/admin/stats/route.ts](../../src/app/api/admin/stats/route.ts)、[src/app/api/cron/ingest/route.ts](../../src/app/api/cron/ingest/route.ts)。
- AI campus radio 已经真实在线，不是 PPT 功能。证据见 [src/lib/radio.ts](../../src/lib/radio.ts)、[src/app/api/radio/playlist/route.ts](../../src/app/api/radio/playlist/route.ts)、[src/app/api/radio/announce/route.ts](../../src/app/api/radio/announce/route.ts) 以及线上接口返回。

2026-03-25 的线上冒烟结果说明“产品已经活着”：

- 首页 SSR 直接展示 `27 Active` 和 `1046 Events`。
- `playlist` API 返回 5 首 morning 曲目。
- `announce` API 返回非空文案和内联 base64 WAV 音频。

但当前产品也有几个不能回避的限制：

- [vercel.json](../../vercel.json) 现在的 cron 频率是每日 `0 6 * * *`，而不是 README 里写的“每小时后台刷新”；实际是“每日 cron + 超过 1 小时时由 SSR 补救”。这对“实时校园脉搏”叙事有直接影响。
- 仓库里没有发现自动化测试文件。
- CSS 已经做了响应式适配，但 [README.md](../../README.md) 仍把 mobile-optimized layout 列为待办，实际体验也仍偏桌面信息密集型。证据见 [src/app/globals.css](../../src/app/globals.css)。
- 首页分类栏在当前线上数据下存在大量 `0` 计数类别，首屏信号密度不够高，容易削弱“打开就知道去哪里”的第一印象。

判断：它已经够资格讲“产品”，但还不够资格讲“无处不在、实时、全民都在用的校园网络”。

## 2. 学生用户的核心需求与高频场景

如果只从学生视角看，Signal-Map 最值得抓的不是“记录校园发生过什么”，而是“帮我更快做出下一步决定”。高频场景大致有 6 类：

- 课间 20 分钟：我现在附近有没有展览、讲座、摆摊、开放活动值得顺路去。
- 今天晚上：晚饭后到睡前，校园里还有什么轻量、低门槛、临时起意也能参加的事。
- 周五/周末：有什么比刷群聊更快的方式，知道 campus life 现在最热的点在哪里。
- 新生前 4 周：我该去哪里感受校园，不想只在宿舍和熟人群里打转。
- 找组织但不想先加群：我想先看“真实发生的活动”再决定是否加入这个圈子。
- 地点导向的生活决策：我路过 The Pit、Polk Place、Student Union、图书馆时，想知道这个地方最近到底“活不活”。

这些场景有三个共同点：

- 它们都带时间压力，答案过时就没价值。
- 它们都带位置约束，“附近”比“全校所有活动”重要。
- 它们都不想先进入社交承诺很重的路径，比如先加群、先关注、先注册一堆组织。

所以，Signal-Map 的日常价值不是“替代所有校园信息源”，而是把学生最常见的“下一步去哪儿”问题缩短成一次打开。

## 3. 替代方案为何不够

UNC 已经不缺信息源，缺的是一个把学生此刻决策所需信息收束起来的入口。

- [Heel Life](https://heellife.unc.edu/) 是官方学生活动与组织中心。UNC 官方材料明确写它是学生活动 hub、覆盖 `900+` 学生组织，并包含活动日历。这让 Heel Life 成为“组织发现”和“报名管理”的强工具，但它天然更偏组织/资料页逻辑，不是“此刻此地附近有什么”的地图逻辑。来源：[Student Life and Leadership PDF](https://catalog.unc.edu/undergraduate/academic-enrichment/student-life-and-leadership/student-life-and-leadership.pdf)、[2022 New Student Guide](https://nsfp.unc.edu/wp-content/uploads/2022/05/2022_NewStudentGuide-Reduced-Size_1.pdf)。
- [UNC Events Calendar](https://calendar.unc.edu/) 的优势是官方、全面、可订阅、可提交，但它面向全校/全人群，更像 institution-wide calendar，不是 student-first 的当下决策工具。
- [Hello Heels / CarolinaGO](https://apps.apple.com/us/app/hello-heels/id924947572) 在官方迎新材料里被直接用于 orientation schedule；App Store 描述强调 location-based notifications、maps、dining、bus routes。它是校园基础设施入口，但不是高密度活动发现层。来源：[Your Best Heel Forward](https://nsfp.unc.edu/wp-content/uploads/2024/05/2024-Your-Best-Heel-Forward.pdf)。
- [GroupMe Campus](https://groupme.com/) 和 [GroupMe Campus Events](https://groupme.com/blog/the-fastest-way-to-fill-the-room-post-your-event-to-groupme-campus) 解决的是“已经在一个圈子里后如何扩散和聊起来”；它更强于群内传播，不强于全校园陌生发现。
- [Discord Student Hubs](https://support.discord.com/hc/da/articles/4406046651927-Ofte-stillede-sp%C3%B8rgsm%C3%A5l-om-Discord-Student-Hubs) 解决的是校内服务器发现与归属，但同样依赖学生主动进入社区结构，不是地点化即时发现。
- [The Daily Tar Heel](https://www.dailytarheel.com/page/subscribe) 和官方迎新材料里提到的学生媒体，提供的是新闻与舆论价值，不是“我 30 分钟后去哪儿”的行动入口。来源同样可见于 [Your Best Heel Forward](https://nsfp.unc.edu/wp-content/uploads/2024/05/2024-Your-Best-Heel-Forward.pdf) 对 DTH 的介绍。
- [CUAB / Student Life and Leadership](https://catalog.unc.edu/undergraduate/academic-enrichment/student-life-and-leadership/student-life-and-leadership.pdf) 每年能做 `200+` 场活动、触达约 `50,000` 人次，说明官方项目供给很多；但每个项目页仍是单点入口，不会自动变成“一张校园实时地图”。

机会不在“比这些工具更权威”，而在“把这些碎片重新组织成学生更容易打开的形态”。

## 4. Signal-Map 的差异化与推荐叙事

Signal-Map 目前最强的主楔子不是 AI，也不是 UGC，而是这两个组合：

- 地图化发现：把校园信息从列表/组织页改造成“空间上可扫一眼”的体验。
- 多源聚合：把官方活动、校园项目、社区投稿和地点上下文收束到同一个入口。

在此基础上，当前产品可以分成三层：

- Discovery layer：地图、热度、活动侧栏、建筑页。
- Trust/context layer：来源聚合、审核流、楼宇评论、管理员重采集。
- Brand/retention layer：AI campus radio。

推荐对外表达也应该是三层，而不是一上来讲“AI”：

一句话定位：Signal-Map 是学生最快看到“此刻此地有什么值得去”的校园本地信息网络。

30 秒学生版：如果你不想在 Heel Life、校历、群聊、海报和 Instagram 之间来回跳，Signal-Map 用一张地图把 UNC 当下正在发生的事收在一起。你打开它，不是为了看一个数据库，而是为了决定下一步去哪儿。

长版叙事：UNC 从来不缺活动，也不缺平台，真正缺的是一个把校园信号变成“可行动的附近信息”的入口。Signal-Map 的价值不是替代 Heel Life、CarolinaGO 或 GroupMe，而是站在它们之间，把分散的官方活动、学生项目和地点氛围重新组织成一个学生会反复打开的实时界面。AI 电台在这里更像品牌层和停留层，用来放大校园氛围，而不是主定义。

不建议当前对外主打的说法：

- “UNC 的社交网络”
- “校园实时操作系统”
- “学生都在上面交流”
- “最完整、最实时的全校事件层”

这些说法目前都会超过产品真实能力。

## 5. 竞品矩阵

| 产品 | 主工作 | 学生为什么打开 | 它比 Signal-Map 强 | Signal-Map 比它强 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Heel Life | 组织目录 + 官方活动 hub | 找组织、看官方活动、管理社团 | 官方性、组织管理深度、覆盖 `900+` 组织 | 地图化、附近感、跨源整合、轻探索 | 最重要的“上游供给层”，不是最终体验层 |
| UNC Events Calendar | 官方全校日历 | 查公开讲座、展览、官方活动 | 全校官方覆盖、订阅能力 | 更学生导向、更空间化、更适合临时决策 | 是权威源，不是高频入口 |
| Hello Heels / CarolinaGO | 校园工具箱 | 看通知、地图、公交、餐饮、迎新日程 | 系统级入口、校园基础设施整合 | 活动发现密度更高，内容更“去哪里玩/参与” | 更像 campus utility，不是 campus pulse |
| CUAB / Carolina After Dark 等官方项目 | 单项目活动供给 | 找强品牌活动 | 品牌背书、项目质量、已有受众 | 能把多个项目和地点放在一个面板里 | 是供给方，不是统一分发层 |
| GroupMe Campus | 校园群与活动扩散 | 找群、进活动聊天、组织传播 | 群关系、传播速度、参与后互动 | 不需要先入群，先发现再决定参与 | 适合放大活动，不适合做首发现 |
| Discord Student Hubs | 校内社群入口 | 找服务器、找同校人 | 社区归属感、话题深度 | 地点化更强、轻量更强、陌生发现成本更低 | 适合垂直社群，不适合“附近正在发生什么” |
| The Daily Tar Heel | 校园新闻媒体 | 获取校园新闻、观点、周更信息 | 公信力、报道深度、议题设置 | 实时性更强、行动导向更强 | 是信息理解层，不是即时行动层 |

矩阵结论：Signal-Map 最该抢的位置，不是“比所有人更全”，而是“把学生此刻最需要的校园信号排在一起，并让位置变得有意义”。

## 6. UNC 校园内最现实的分发与增长路径

最现实的增长，不是买量，也不是指望学生自发形成网络效应，而是嵌进 UNC 已有的信息流入口。

优先合作入口：

- Student Life and Leadership / Heel Life 体系：因为它本来就在管理 `900+` 组织和活动供给，是最自然的供给侧合作对象。来源：[Student Life and Leadership PDF](https://catalog.unc.edu/undergraduate/academic-enrichment/student-life-and-leadership/student-life-and-leadership.pdf)。
- New Student & Family Programs / Orientation / WOW：官方迎新材料已经把 CarolinaGO、Heel Life、新生活动路径讲给学生听，说明 onboarding 本来就存在“告诉学生去哪里看校园生活”的窗口。来源：[Your Best Heel Forward](https://nsfp.unc.edu/wp-content/uploads/2024/05/2024-Your-Best-Heel-Forward.pdf)、[2022 New Student Guide](https://nsfp.unc.edu/wp-content/uploads/2022/05/2022_NewStudentGuide-Reduced-Size_1.pdf)。
- Carolina Union / CUAB / Carolina After Dark 体系：这些活动自带强峰值流量，适合验证“Signal-Map 是否能接住周五晚上的即时打开需求”。来源：[Student Life and Leadership PDF](https://catalog.unc.edu/undergraduate/academic-enrichment/student-life-and-leadership/student-life-and-leadership.pdf)、[2022 New Student Guide](https://nsfp.unc.edu/wp-content/uploads/2022/05/2022_NewStudentGuide-Reduced-Size_1.pdf)。

最现实的 30 天实验：

| 实验 | 假设 | 成本 | 成功信号 |
| --- | --- | --- | --- |
| Welcome Week / WOW 落地页 + 二维码 | 新生最需要“附近发生什么”的入口，早期形成习惯最容易 | 低 | 每日直接访问、二次回访率、活动点击率 |
| 10 个学生组织种子合作 | 只要供给更准更活，学生会把它当发现入口而不是数据库 | 低到中 | 被合作活动的浏览量、收藏/点击、分享率 |
| The Pit / Student Union / Polk Place 线下二维码 | 线下路过的人天然有“这里正在发生什么”需求 | 低 | 扫码转化、页面停留、建筑页访问 |
| 每周一张 “Tonight at UNC” 社媒卡片 | Signal-Map 可以先作为分发引擎，再把人带回产品 | 低 | 社媒点击、夜间访问峰值、周五回访 |
| 3 个高流量建筑的评论/提示语种子运营 | 地点页如果有活跃上下文，会提升“网络感” | 中 | 评论率、建筑页回访率、从建筑页到活动页跳转率 |

渠道优先级判断：

- 优先做 onboarding、官方项目合作、线下二维码。
- 次优先做 Instagram/Reddit/学生媒体导流。
- 不建议一开始把精力押在“社交裂变”上，因为当前社区层密度还不够。

## 7. 技术与运营可信度风险

| 风险 | 证据 | 是否削弱对外故事 | 修复紧迫度 | 建议归类 |
| --- | --- | --- | --- | --- |
| 建筑匹配率只有 74% | [README.md](../../README.md)、[STATUS.md](../../STATUS.md) | 会直接削弱“地图是主体验”的可信度，因为 26% 事件无法稳定位到地点 | 高 | 产品补课 |
| 数据刷新不是稳定小时级 | [vercel.json](../../vercel.json) 是 daily cron，首页只在 stale 时补救 | 会削弱“校园此刻正在发生什么”的承诺 | 高 | 产品补课 |
| 缺自动化测试 | 仓库未发现测试文件 | 会限制高频迭代后的可靠性，尤其是 ingest、审核、radio | 中高 | 产品补课 |
| 移动端仍偏桌面信息架构 | [src/app/globals.css](../../src/app/globals.css) 有响应式，但 [README.md](../../README.md) 仍把 mobile optimized 列为待办 | 会削弱学生高频、碎片时间打开的实际体验 | 高 | 产品补课 |
| 社区层密度尚未被验证 | 代码里有评论和用户活动，但无法从线上迹象证明已有强互动密度 | 会削弱“本地信息网络”里“network”那一半的可信度 | 高 | 叙事限制 |
| 审核与运营仍偏人工 | 投稿进入 `PENDING`，admin token 和后台是关键人工节点 | 如果投稿量上来，供给速度与质量会变成瓶颈 | 中高 | 产品补课 |
| 首页首屏信噪比不够高 | 线上首屏出现大量 `0` 计数分类 | 会削弱首次打开的“立刻看懂哪里热闹” | 中 | 产品补课 |

风险总判断：

- 现在最危险的不是“功能不够多”，而是“主故事的几个关键词还没有被工程与运营完全托住”。
- 真正会伤害对外故事的，是地图错位、内容不新鲜、手机上不好用，以及过早宣称自己已经形成社区网络。

## 8. 下一步叙事与产品优先级

最该讲的故事：

- “一张校园地图，看见 UNC 此刻真正活着的地方。”
- “把 Heel Life、官方日历、学生项目和地点上下文收束成一个更快的入口。”
- “让学生少做搜索，多做决定。”

暂时不要先讲的故事：

- “AI campus radio 是主产品。”
- “Signal-Map 已经是 UNC 的学生社交网络。”
- “它覆盖了校园所有实时活动。”
- “它已经是成熟的移动端日常习惯。”

接下来最值得优先做的事，按顺序建议如下：

1. 先补产品可信度，再放大叙事。  
   重点是刷新频率、建筑匹配率、移动端信息架构、首屏分类去噪。
2. 把“network”建立在地点和供给密度上，而不是空喊社区。  
   先让关键建筑页和关键时段真正有信息密度，再谈 UGC 网络效应。
3. 把 radio 留在品牌和留存层。  
   它能增强氛围、做差异化，但不该盖过主楔子。
4. 多校园扩张的前提，不是技术抽象，而是先证明单校园复访。  
   最重要的里程碑不是多学校接入，而是 UNC 学生是否会在一周内反复回来 2 到 4 次。

最终建议：

- 叙事调整：现在就可以把 Signal-Map 对外定义成“校园本地信息网络”，但必须把这个定义落在“地图化发现 + 多源聚合”上。
- 产品补课：在讲大故事前，至少先把 freshness、match rate、mobile、首屏信噪比这 4 件事抬到更稳的水平。

---

## 附录 A：关键证据底稿

仓库与产品事实：

- [README.md](../../README.md)
- [STATUS.md](../../STATUS.md)
- [CLAUDE.md](../../CLAUDE.md)
- [src/app/page.tsx](../../src/app/page.tsx)
- [src/components/event-sidebar.tsx](../../src/components/event-sidebar.tsx)
- [src/components/map-panel.tsx](../../src/components/map-panel.tsx)
- [src/components/radio-player.tsx](../../src/components/radio-player.tsx)
- [src/components/submit-event-form.tsx](../../src/components/submit-event-form.tsx)
- [src/components/comment-section.tsx](../../src/components/comment-section.tsx)
- [src/app/building/[id]/page.tsx](../../src/app/building/[id]/page.tsx)
- [src/app/admin/page.tsx](../../src/app/admin/page.tsx)
- [src/app/api/events/route.ts](../../src/app/api/events/route.ts)
- [src/app/api/events/submit/route.ts](../../src/app/api/events/submit/route.ts)
- [src/app/api/events/user/route.ts](../../src/app/api/events/user/route.ts)
- [src/app/api/comments/route.ts](../../src/app/api/comments/route.ts)
- [src/app/api/cron/ingest/route.ts](../../src/app/api/cron/ingest/route.ts)
- [src/app/api/radio/playlist/route.ts](../../src/app/api/radio/playlist/route.ts)
- [src/app/api/radio/announce/route.ts](../../src/app/api/radio/announce/route.ts)
- [src/lib/ingest/service.ts](../../src/lib/ingest/service.ts)
- [src/lib/ingest/normalizer.ts](../../src/lib/ingest/normalizer.ts)
- [src/lib/ingest/freshness.ts](../../src/lib/ingest/freshness.ts)
- [src/lib/radio.ts](../../src/lib/radio.ts)
- [src/app/globals.css](../../src/app/globals.css)
- [vercel.json](../../vercel.json)

线上检查：

- [https://hdmap.live/](https://hdmap.live/)
- [https://hdmap.live/api/radio/playlist?period=morning](https://hdmap.live/api/radio/playlist?period=morning)
- [https://hdmap.live/api/radio/announce?period=morning](https://hdmap.live/api/radio/announce?period=morning)

外部来源：

- [Student Life and Leadership PDF](https://catalog.unc.edu/undergraduate/academic-enrichment/student-life-and-leadership/student-life-and-leadership.pdf)
- [UNC Events Calendar](https://calendar.unc.edu/)
- [2022 New Student Guide](https://nsfp.unc.edu/wp-content/uploads/2022/05/2022_NewStudentGuide-Reduced-Size_1.pdf)
- [Your Best Heel Forward](https://nsfp.unc.edu/wp-content/uploads/2024/05/2024-Your-Best-Heel-Forward.pdf)
- [Heel Life](https://heellife.unc.edu/)
- [Hello Heels / CarolinaGO App Store](https://apps.apple.com/us/app/hello-heels/id924947572)
- [GroupMe](https://groupme.com/)
- [GroupMe Campus Events](https://groupme.com/blog/the-fastest-way-to-fill-the-room-post-your-event-to-groupme-campus)
- [Discord Student Hubs FAQ](https://support.discord.com/hc/da/articles/4406046651927-Ofte-stillede-sp%C3%B8rgsm%C3%A5l-om-Discord-Student-Hubs)
- [The Daily Tar Heel newsletters](https://www.dailytarheel.com/page/subscribe)
