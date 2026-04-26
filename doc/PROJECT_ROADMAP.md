# 项目规划与长期优化路线（PROJECT ROADMAP）

> 更新时间：2026-04-24  
> 目标：从“可玩”走向“可持续迭代、可维护、可平衡、可扩展”

---

## 1. 现状审视

### 1.1 当前优势

- 核心玩法闭环完整：建造 → 连线 → 防守 → 波次推进
- 内容体量充足：多节点、多敌人、多关卡、科技树、成就、教程
- 纯前端部署轻量：Vite + Canvas，GitHub Pages 自动部署
- 代码模块拆分较清晰：输入、渲染、图算法、实体逻辑、UI 分层

### 1.2 主要问题

- **UI 响应式欠一致**：部分页面在高内容密度下会出现拥挤、遮挡、可读性下降
- **系统耦合仍偏高**：`GameState` 单体状态较大，部分逻辑跨文件依赖较紧
- **平衡数据分散**：数值主要写在代码常量中，缺少统一调参通道
- **性能监控不足**：缺少帧时、实体数量、粒子负载的可视化诊断面板
- **自动化测试薄弱**：核心算法/规则缺少回归测试，改动后易引入隐性行为回退
- **内容生产效率可提升**：新增关卡/节点时需多处手工同步

---

## 2. 北极星目标（6-12个月）

- **稳定性**：关键回归问题显著减少，版本更新可预测
- **可维护性**：模块边界清晰，新增内容不需要大范围改代码
- **可扩展性**：节点/敌人/关卡接近“配置驱动”扩展
- **体验一致性**：UI 在不同分辨率与内容规模下保持可读与可操作
- **性能可观测**：出现卡顿时可快速定位瓶颈

---

## 3. 分阶段路线图

## Phase A（1-2周）：体验与可用性收敛

### 目标
- 优先修复玩家可感知问题，确保主要流程稳定。

### 任务
- 全面梳理关键页面响应式：登录、选关、选卡、HUD、科技树、成就面板
- 统一交互提示文案和键位描述（避免教程与实际行为偏差）
- 补充“小屏模式”布局策略（最小宽高断点）
- 建立基础 UI 设计 token（字号、间距、面板宽度、颜色层级）

### 验收标准
- 在 1366x768 / 1920x1080 / 2560x1440 三档下核心页面无截断、无重叠
- 关键流程（登录→选关→选卡→游戏）连续体验无阻断

---

## Phase B（2-4周）：数据与平衡体系化

### 目标
- 降低调平衡成本，让“改数值”无需改多处逻辑。

### 任务
- 将节点/敌人关键数值抽离为统一配置层（含注释与默认值）
- 建立“平衡参数表”与版本记录（用于对比改动前后效果）
- 增加波次曲线工具：生成每波敌人强度估算值
- 设立基准对局（benchmark seeds）用于平衡回归

### 验收标准
- 一次平衡改动可在单处配置完成
- 至少 3 套 benchmark 对局可重复复现

---

## Phase C（3-6周）：性能与可观测性

### 目标
- 让性能问题可测、可视、可定位。

### 任务
- 增加开发调试 HUD（FPS、tick时长、敌人数、粒子数、投射物数）
- 渲染分层采样：识别最重的绘制路径
- 粒子与特效预算机制（超过阈值自动退化）
- 研究对象池策略（particles/projectiles）以降低 GC 抖动

### 验收标准
- 高压场景下平均帧时明显下降
- 可在调试面板中定位主要性能瓶颈

---

## Phase D（4-8周）：工程质量与自动化

### 目标
- 通过自动化减少回归风险，提高迭代速度。

### 任务
- 为核心纯逻辑模块补充单元测试（graph/levels/tech）
- 增加关键流程的端到端冒烟测试（可先从最小脚本开始）
- 建立 PR 检查：lint/build/test 通过后再合并
- 增加“发布检查清单”文档化流程

### 验收标准
- 核心逻辑模块具备基础测试覆盖
- 每次发布前可以自动执行最小回归集合

---

## Phase E（持续）：内容扩展与玩法深挖

### 目标
- 在稳定底座上持续做新内容，保证“新鲜感 + 可控复杂度”。

### 方向
- 新节点玩法分层：经济、控制、防御、风险收益
- 新敌人机制分层：路径干扰、能量侵蚀、反制特定流派
- 关卡叙事化：地图主题 + 专属机制 + 目标变化
- 周挑战/每日变体：固定规则修改器（如“低能量模式”）

---

## 4. 风险与应对

- **风险：功能持续堆叠导致维护成本上升**
  - 应对：优先做配置化、抽象化，再扩内容
- **风险：平衡调优周期长**
  - 应对：建立 benchmark 与回放种子
- **风险：低端设备性能不稳**
  - 应对：引入质量分级（特效档位）
- **风险：文档滞后**
  - 应对：每次版本提交同步更新 changelog + roadmap 进度

---

## 5. 量化指标（建议）

- 构建稳定性：主分支连续构建通过率
- 体验质量：关键流程阻断 bug 数量
- 性能：高压场景平均帧时 / 99th 帧时
- 平衡：关卡通关率分布（按关卡/版本）
- 工程效率：新增节点从设计到上线的平均耗时

---

## 6. 跟进机制

- 每周：更新一次本路线图状态（进行中 / 已完成 / 延后）
- 每版本：在 `CHANGELOG.md` 追加“本版本对路线图的推进项”
- 每月：回顾一次路线是否需要重排优先级

---

## 7. 当前迭代（本次）已落地事项

- 选卡页布局改为自适应网格，支持多行内容与光标行可见性
- 选关页列表按屏幕高度自适应，减少新增关卡后挤压
- 关卡扩展至 8 关（新增第 7 / 8 关）
- **过渡平滑性专项**（Phase A）：
  - 新增全局屏幕过渡模块 `src/transition.ts`，所有屏幕切换（登录 → 选关 → 过场 → 选卡 → 游戏 → 回到选关）统一走淡入淡出，长度按上下文调整（进入战斗略长、回退略短）
  - 首屏启动加入初始黑幕，避免白闪
  - 摄像机插值拆成位移 / 缩放两条曲线，缩放采用更慢的指数收敛，避免滚轮缩放突兀
  - 补齐第 7 / 8 关过场剧情，并将第 6 关由"终章"语义化为承上启下的"第六章 · 虫巢终焉"
  - HUD 进入战斗时 easeOutCubic 淡入；径向菜单切换节点时 easeOutBack 缩放+透明度展开（动画前段禁用点击防误触）
  - 科技 / 成就 / 快捷键 三个浮层面板加入 180ms easeOutCubic 淡入淡出
- **UI 设计 Token 起步**（Phase A）：
  - 新增 `src/ui-tokens.ts`，集中收口颜色（accent / text / bg / border）、字号、间距、圆角、动画时长，并提供 `withAlpha` 工具
  - HUD 顶栏完成第一轮迁移作为示范，后续按文件渐进式替换以降低回归风险

后续建议优先推进：把 `level-select` / `node-select` / `login` / `cutscene` / `ui` 其余区段按 token 渐进式迁移，并补充一份"主题切换"骨架以便后续支持暗/亮或可定制配色。

---

## 8. Phase A 收口（2026-04-25 增补）

### 已完成（按提交顺序）

- **Token 全量迁移**：login / ui / renderer / game / graph / cutscene / level-select / node-select 全量替换硬编码颜色与字号；ui.ts 仍保留 ~30 处低频颜色与 3 处动态 rgba 模板（按需保留）
- **动画时长 token 化**：`ANIM` 扩展到 12 个字段（screenFadeOut/In、enterGameIn/Out、exitGameOut/In、bootFadeIn、hudFadeIn、radialMenuIn 等），transition / main / ui 全部接入
- **主题系统骨架 → 实切换**：
  - `src/themes.ts`：deepAssign-based override、`themeBus` EventTarget、localStorage 持久化（`starfield.theme`）、`Shift+T` 全局唤出
  - `COLORS` 改为可变（带 `DEFAULT_COLORS` 快照），`NODE_CONFIGS.glowColor` / `EDGE_CONFIGS.color` / `ENEMY_COLORS` 全部建立默认快照并支持 override
  - 6 套预设主题：`cyan`(默认) / `warm`(暖橙) / `mono`(单色灰) / `sakura`(樱粉) / `contrast`(高对比荧光) / `forest`(深林翠绿)，每套包含 accent / bg / border / nodeGlow / enemyColor / edgeColor 完整覆盖
- **主题选择 UI 面板**：`src/theme-picker.ts` DOM 浮层，淡入 + 轻微下移、键盘 ↑↓/Enter/Esc、点击应用即关、自身配色随主题切换实时刷新；`Shift+T` 由"循环切换"改为"打开/关闭面板"
- **登录界面订阅**：`LoginScreen` 监听 `themeBus` 实现非 RAF 屏的实时主题响应

### 退出标准评估

- 1366×768 / 1920×1080 / 2560×1440 三档下核心页面无截断、重叠 ✅
- 登录 → 选关 → 过场 → 选卡 → 游戏 → 回到选关 全链路过渡顺滑、无白闪/断点 ✅
- 主题可在任意阶段切换且立即响应（含 DOM 浮层与 canvas 渲染） ✅

### Phase A 成果度量

- 构建产物：155 KB / gzip 45 KB（相比 Phase A 起点 ~140 KB / gzip ~40 KB，扩张主要来自 themes.ts 的 6 套预设映射）
- 模块新增：`src/themes.ts`、`src/theme-picker.ts`、`src/ui-tokens.ts`（已存）
- 设计 token 覆盖：颜色 ~150 处、字号 ~30 处、动画时长 12 处

### Phase A → Phase B 切换说明

Phase A 体验/可用性收敛任务已基本闭环。剩余可选优化（成就 Toast slide+fade、面板打开 token 化动画、用户自定义主题、主题预览色块）转入 Phase E（持续优化）按需推进。

下一步进入 **Phase B：数据与平衡体系化**，重点：

1. 抽离 NODE_CONFIGS / ENEMY_CONFIGS / WAVE 数值至 `src/data/` 配置层
2. 建立 benchmark seed 用于平衡回归
3. 引入存档校验 / 简单防作弊（前端校验和 + 关键数据签名）

---

## 9. Phase B-1 配置层抽离收口（2026-04-26 增补）

### 已完成

将原本散落在 `types.ts` / `levels.ts` / `achievements.ts` / `tech.ts` / `entities.ts` 的纯数据迁移至独立 `src/data/` 目录，原文件改为类型 + 运行时逻辑 + re-export，全部存量调用零改动。

| 数据文件 | 内容 | 来源 |
|---------|------|------|
| [src/data/nodes.ts](../src/data/nodes.ts) | NODE_CONFIGS（23 节点）+ DEFAULT_NODE_GLOW | types.ts |
| [src/data/edges.ts](../src/data/edges.ts) | EDGE_CONFIGS（4 边）+ DEFAULT_EDGE_COLORS | types.ts |
| [src/data/enemies.ts](../src/data/enemies.ts) | ENEMY_COLORS（9 类）+ DEFAULT_ENEMY_COLORS | types.ts |
| [src/data/levels.ts](../src/data/levels.ts) | LEVELS（8 关卡） | levels.ts |
| [src/data/achievements.ts](../src/data/achievements.ts) | ACHIEVEMENTS（11 项） | achievements.ts |
| [src/data/tech.ts](../src/data/tech.ts) | createTechTree（10 科技） | tech.ts |
| [src/data/spawn.ts](../src/data/spawn.ts) | ENEMY_BASE_STATS / ENEMY_UNLOCK_WAVE / TARGET_WEIGHT_BY_ENEMY / getBossStats / SPAWN_DIST_* | entities.ts |
| [src/data/index.ts](../src/data/index.ts) | barrel 统一出口 | — |

### 关键改造

- **types.ts 瘦身**：保留接口/枚举与少量平衡常量（MAX_EDGE_LENGTH、TICK_INTERVAL、EVOLUTION_LEVEL 等），数据全部 re-export 自 `./data/`
- **敌人解锁表化**：原 `entities.ts` 中 4 段 `wave >= N ? ['type'] : []` 拼装代码改为 `ENEMY_UNLOCK_WAVE` Record，调难度只需改一张表
- **Boss 公式独立**：`getBossStats(wave)` 单独函数，方便后续 benchmark 对比
- **保持 import 兼容**：所有现有 `from './types'` / `from './levels'` / `from './tech'` 等导入路径继续可用，无需改动业务代码

### 度量

- 构建产物：154.20 kB / gzip 44.96 kB（相比 Phase A 收口 156 kB 略减；tree-shaking 受益于函数化 createTechTree 抽离）
- 新增模块：8 个（包含 barrel）
- 修改文件：types.ts、levels.ts、achievements.ts、tech.ts、entities.ts
- 提交序列：26f9d53 → e44294e → 7fbe4b6 → dfba3c3 → b0fb235

### 退出标准

- ✅ `src/data/` 目录建立，含 7 类纯数据文件 + barrel
- ✅ 各原宿主文件不再包含数据字面量，仅保留类型与逻辑
- ✅ 构建通过、本地预览、GitHub Pages 部署正常
- ✅ 包体未膨胀（154 kB vs 156 kB Phase A 末态）

### Phase B-1 → Phase B-2 切换

数据层物理隔离已完成，后续可选优化（按需推进，不阻塞 B-2）：

- 各业务文件直接 `from './data/...'`，去除 types.ts 中间转发层
- 抽离散落的平衡常量（CORE_ENERGY_PRODUCTION、ENEMY_SPAWN_BASE_INTERVAL 等）至 `data/balance.ts`

下一步进入 **Phase B-2：benchmark seeds**，建立可复现的平衡回归基线。

---

## 10. Phase B-2 benchmark seeds 收口（2026-04-26 增补）

### 已完成

构建可复现的随机数 + headless benchmark 链路，平衡回归与压测可定量化。

**新增模块**

| 文件 | 内容 |
|------|------|
| [src/rng.ts](../src/rng.ts) | mulberry32 PRNG + `setSeed/getSeed/rand/initSeedFromURL`；seed=0 时 `rand()` 透明回退 `Math.random` |
| [src/benchmark.ts](../src/benchmark.ts) | URL 参数解析 + headless runner，跳过 UI 直接进游戏，固定 timeScale 跑到目标后 dump 统计 |

**改造点**

- [src/main.ts](../src/main.ts)：启动期调用 `initSeedFromURL`；检测 `?bench=1` 时跳过 LoginScreen 走 `runBenchmark`
- [src/entities.ts](../src/entities.ts) / [src/graph.ts](../src/graph.ts) / [src/particles.ts](../src/particles.ts)：所有 `Math.random()` 改为 `rand()`
- [src/ui.ts](../src/ui.ts) drawHUD：注入 seed 时右上角显示紫色 `SEED N` 标识
- [src/game.ts](../src/game.ts)：`state` 由 private 改为 public，便于 benchmark 轮询

### URL 参数清单

| 参数 | 默认 | 说明 |
|------|------|------|
| `seed` | 0（不复现） | 32-bit 整数；非 0 即启用 mulberry32 |
| `bench` | 0 | =1 启用 headless 模式 |
| `level` | 1 | 关卡 id（1~8） |
| `waves` | 10 | 目标波数；达到后采集 |
| `speed` | 4 | 锁定 timeScale |
| `nodes` | energy,turret,mine,shield,relay | 节点池 csv |

### 输出格式

`window.__benchResult` + `console.info('[bench] result', ...)`：

```ts
{
  seed, levelId, targetWaves, speed,
  reachedWave, finalScore, totalTicks,
  finalNodeCount, finalEnemyCount,
  outcome: 'won' | 'gameover' | 'reached_target',
  elapsedMs
}
```

### 度量

- 构建产物：155.63 kB / gzip 45.93 kB（相比 B-1 末 154.20 kB 增 +1.4 kB，含 RNG + benchmark + bench result schema）
- 提交序列：a62f8e3（RNG 基础）→ 42dbad5（HUD seed）→ 5bc93a9（benchmark runner）

### 退出标准

- ✅ 同 seed + 同 URL 参数刷新，结果完全一致（本地预览已验证）
- ✅ seed=0 时游戏行为与 B-1 末态完全一致（不影响普通玩家）
- ✅ benchmark 模式可在 console 拿到 JSON，外部脚本可解析
- ✅ HUD 仅在 seed 注入时显示标识，不污染普通体验

### Phase B-2 → Phase B-3 切换

后续可选增强（按需推进，不阻塞 B-3）：

- Node + puppeteer/playwright 量化脚本：批量跑 N seed × M 关卡，输出 CSV，平衡调整前后回归对比
- Benchmark dump 增加：每波 score/enemy/node 时序，便于绘制曲线
- Tutorial / 教程暂停：当前 benchmark 模式下若进入第 1 关会触发教程暂停（已通过 isTutorialDone 跳过，复现性 OK）

下一步进入 **Phase B-3：存档防作弊**，重点：

1. SaveProfile 序列化时附加校验和（基于 sessionSecret 的 HMAC-like）
2. 加载时校验，篡改即丢弃当前存档并提示
3. 关键统计字段（score / clearedLevels / unlockedTechs）单独签名


---

## 11. Phase B-3 存档防篡改收口（2026-04-26 增补）

### 已完成

为 `localStorage` 存档加非密码学签名信封，挡住 99% devtools 直接修改器；老格式自动升级，篡改即丢弃并 Toast 提示。

**新增模块**

| 文件 | 内容 |
|------|------|
| [src/save-sig.ts](../src/save-sig.ts) | `cyrb53` 53-bit 非密码学哈希（mulberry 派生）+ `signPayload` / `verifyPayload`；SECRET 内嵌（`sf-nodes-v1-2026:falling-feather`） |

**改造点**

- [src/save.ts](../src/save.ts)：`loadProfiles` / `saveProfiles` 改用 `{ data: SaveProfile[], sig: string }` 信封；裸数组（B-2 末态及更早）一次性升级；解析失败 / 签名失败均移除并触发 `tamperHandler`；新增 `setTamperHandler` 公共 API
- [src/main.ts](../src/main.ts)：启动期注册 `setTamperHandler` → 顶部红色 DOM Toast（`invalid_sig` / `parse_error` 文案区分），4s 自动淡出，不阻塞流程

### 设计取舍

- **为何用 cyrb53 而不是 SubtleCrypto / HMAC**：纯前端无密钥分发场景下任何 JS 内嵌密钥都可被读取；目标只是阻挡 devtools 直接改 `stats.highScore` 的 99% 用户，cyrb53 ~150 字节、零依赖、O(n) 已足够
- **为何选信封而非旁路 `_sig` key**：单 key 原子写入，避免 sig 与 data 不同步；且 JSON.parse 一次完成
- **为何老格式自动升级而非版本号**：当前期玩家基数小、字段稳定；无声升级避免任何 UX 中断；后续若要破坏性改 schema 再引入 `version` 字段
- **为何不签 `ACTIVE_KEY`**：仅存账号名字符串，篡改最坏切换到不存在账号，loadProfiles 自动返回空数组 → 重置回登录界面，无作弊空间

### 度量

- 构建产物：157.32 kB / gzip 46.65 kB（相比 B-2 末 155.63 kB 增 +1.7 kB，含 cyrb53 + 信封读写 + Toast 样式）
- 提交：658e377（save-sig.ts + save.ts 信封 + main.ts Toast）

### 退出标准

- ✅ 老格式裸数组刷新后自动转为 `{data,sig}` 信封，无 Toast 干扰、账号无感
- ✅ 篡改 `sig` 字段刷新 → 顶部红色 Toast「存档校验失败，已重置」+ `localStorage` 清空
- ✅ 写入非 JSON 字符串刷新 → Toast「存档解析失败，已重置」+ 清空
- ✅ 普通游戏流程（创建/读取/更新/删除存档）零回归
- ✅ 包体增量 < 2 kB

### Phase B-3 → Phase B 收口

Phase B（数据与平衡体系化）三阶段全部落地：

| 阶段 | 关键产出 | 度量 |
|------|---------|------|
| B-1 配置层 | `src/data/` 7 文件 + barrel | 0 行业务改动 |
| B-2 benchmark | `rng.ts` + `benchmark.ts` + URL 复现 | +1.4 kB |
| B-3 防篡改 | `save-sig.ts` + 信封 + Toast | +1.7 kB |

可选后续（按需进 Phase E）：

- 关键字段（`stats.highScore` / `clearedLevels` / `unlockedTechs`）二级签名，挡住"信封整体替换为合法旧值"的回放攻击
- `data/balance.ts` 抽离平衡参数（节点造价、敌人血量曲线、波次推进）
- Node + Playwright 批量 benchmark 脚本，对比平衡调整前后 100 seed × 8 level 的胜率/通关波次分布

下一步建议进入 **Phase E（持续优化）** 或 **Phase C（性能与可观测性）**，由用户按当前痛点决定优先级。

---

## 12. Phase E 第一轮深化（2026-04-26 增补 · Phase B 后续）

### 已完成

在 Phase B-3 收口后，本轮进一步完成三个 Phase E 交付点：存档二级签名 · 平衡参数集中化 · 节点战斗系数表。

| commit | 主题 |
|--------|------|
| `94c2221` | feat(save): profile 二级签名 `__sig` 独立 SECRET2 |
| `d6ba75a` | feat(debug): `?debug=1` 暴露 `window.__saveSig` |
| `0fc588b` | refactor(data): 新建 `src/data/balance.ts`，ECONOMY/RUNTIME/OVERCHARGE/ENEMY_DEATH_REWARDS |
| `63d8462` | refactor(data): COMBAT 表集中 13 个节点的射程/伤害/治疗/AoE 系数 |

### 二级签名（`__sig`）

- 独立 `SECRET2` + `seed = 0xbadcafe`，与外层信封路径不共享字节流，避免二者哈希冲突误判
- 计算 `computeProfileSig(p) = signProfile(JSON.stringify(profile 排除 __sig))`
- 加载顺序：外层信封 → 逐个 profile 验证 `__sig` → 缺失视为老格式（下次保存补上） → 不匹配单条丢弃且触发 `invalid_sig` Toast
- 包体增量：~0.45 kB

### debug 钩子

- `?debug=1` 启动时静态 import `./save-sig` 并挂到 `window.__saveSig`，允许本地验证："信封整体签名合法但单条 `__sig` 不合法"这种需要 SECRET 才能构造的场景
- 静态 import 同时消除 vite `INEFFECTIVE_DYNAMIC_IMPORT` 警告

### balance.ts 首批

集中出事点：

| 分组 | 字段示例 |
|------|--------|
| `ECONOMY` | upgradeBaseCost / upgradeEnergyGrowth / upgradeHpGrowth / evolutionCostMult / evolutionCrystalDivisor / evolutionAttrGrowth / territoryDiscount / expandCost / expandCrystalCost |
| `ENEMY_DEATH_REWARDS` | scout/heavy/swarm/stealth/splitter/disruptor/healer/shielder/boss 完整击杀奖励，+ `DEFAULT_ENEMY_REWARD` 兜底 |
| `RUNTIME` | tickIntervalMs / maxEdgeLength / coreEnergyProduction / enemySpawnBaseInterval / territoryRadius / territoryRadiusExpanded / evolutionLevel |
| `OVERCHARGE` | threshold / buildup / duration / cooldown |

接入调用点：

- [src/entities.ts](../src/entities.ts) 三个奖励 Map → `ENEMY_DEATH_REWARDS`
- [src/input.ts](../src/input.ts) 升级/进化公式 → `ECONOMY.*`
- [src/graph.ts](../src/graph.ts) 4 个 OVERCHARGE 私有常量 → `OVERCHARGE.*`

### COMBAT 表

以节点为主键，为 normal/evolved/overcharge 三档形态提供 `n/e/oc` 可选子字段。已覆盖 13 个节点：

- `turret`：rangeBase 180 / damageBase 15
- `shield`：range n150 e200 / heal n5 e8
- `repair` & `repairPulse`：range n180 e220 / n250 e300，heal n10 e15 / n18 e25
- `radar`：range n200 e280 oc350 / damage n3 e5 oc8
- `mine`：blast n150 e250 / damage n200 e350 / falloffMax 0.5
- `arc`：range n160 e200 oc250 / damage n10 e15 oc20 / bounce n80 e100
- `blackhole`：range n120 e160 oc200 / crushRange n40 e60 oc80 / crushDamage n8 e15 oc16
- `interceptor`：range n130 e170 / damage 5
- `antiRepair`：rangeBase 200
- `factory`：range 200 / aoe n60 e80 / damage 12
- `sniper`：rangeBase 250 + perLevel 30 / damage 30 / overchargeMult 3 / splash 60
- `tesla`：damage 8 / hitRange 25 / chainRatio 0.5
- `trap`：detect 80 / blast 120 / damage 80

未迁移（本批跳过，列为后续待办）：magnet 几个变体 / toxin 雾区 / kamikaze 自爆 / portal / turret evolved 的 AoE 半径 40。

### 度量

| 项 | 值 |
|----|-----|
| 包体 | 160.53 kB / gzip 47.58 kB |
| 相对 §11 尾 | +2.28 kB |
| 增量来源 | balance.ts 结构 (~1.8 kB) + COMBAT 表项 (~0.45 kB) |

### 退出标准

- ✅ `__sig` 代码路径本地验证以调试钩子走通：A 保留、B 单条丢弃、Toast 弹出
- ✅ 全量重构后同 seed 运行确定性一致（benchmark 复跳重跳一致）
- ✅ 原有公共 API（`EXPAND_COST` / `EVOLUTION_LEVEL` / `getEvolutionCost` 等）全保留 re-export，零业务回归
- ✅ 包体增量 < 3 kB

### 下一轮进攻方向（待选）

1. **COMBAT 补齐** — magnet/toxin/kamikaze/portal 等位点，达到 100% 覆盖
2. **Playwright 批量 benchmark** — 脚本跑 N seed × 8 level，输出 CSV，提供调参回归防护网
3. **Phase C 性能优化** — FPS HUD · 帧时间预算 · QuadTree 空间加速

---

## 13. Phase E 第二轮（2026-04-26 · COMBAT 收尾 + benchmark perWave）

### 已完成

| commit | 主题 |
|--------|------|
| `e64e5ce` | refactor(data): COMBAT 表补齐 magnet/toxin/kamikaze/portal + turret evolvedAoeRadius |
| `06b4216` | feat(bench): perWave 时序 dump（每波结束 + 局终快照） |

### COMBAT 收尾（13 → 17 节点）

新增条目，使 COMBAT 表覆盖率达到 100%：

- `magnet`：normal/evolved/overcharge 三档，每档 `pullRange` + `slowFactor`
- `toxin`：damagePerTick / slowFactor / fogRadius
- `kamikaze`：detonationDamage / detonationRadius
- `portal`：teleportRange
- `turret`：补 `evolvedAoeRadius`（之前只有 rangeBase + damageBase）

接入调用点：[src/graph.ts](../src/graph.ts) 5 个相关函数（fireTurret AoE / kamikazeDetonate / toxinCloud / portalTeleport / magnetSlow + overchargeMagnetSlow + evolvedMagnetPull）全部改读 `COMBAT.*`，无残留 magic number。

### benchmark perWave 时序

`BenchResult.perWave: BenchWaveSample[]` 新增字段，提供时序级数据，便于离线绘制曲线 / 离群点检测：

```ts
interface BenchWaveSample {
  wave: number;       // 该样本对应波次
  tick: number;       // 抓样瞬间 game.state.tick
  score: number;      // 抓样瞬间累计分数
  nodeCount: number;  // 抓样瞬间节点数
  enemyCount: number; // 抓样瞬间敌人数
  elapsedMs: number;  // 距 benchmark 启动的实墙时
  kind: 'wave_end' | 'final';
}
```

采样规则：

- 每次轮询发现 `state.wave` 自上一帧改变 → 推一条 `wave_end`，记录的是**刚刚结束**的那一波
- 局终（won / gameover / reached_target）瞬间额外推一条 `kind: 'final'`
- 因此目标 N 波 reached_target 通常会得到 N 条样本（N-1 条 wave_end + 1 条 final）

### 度量

| 项 | 值 |
|----|-----|
| 包体 | 162.13 kB / gzip 47.94 kB |
| 相对 §12 尾 | +1.60 kB |
| 增量来源 | COMBAT 4 节点条目 (~1.25 kB) + perWave 字段与采样逻辑 (~0.35 kB) |

### 退出标准

- ✅ 17 节点 COMBAT 表完整，全部射程/伤害/AoE/槽参数 SoT 集中于 [src/data/balance.ts](../src/data/balance.ts)
- ✅ 同 seed 同节点池运行 benchmark，`reachedWave` / `finalScore` / `totalTicks` 与上一版完全一致（无 magic number 漂移）
- ✅ `?bench=1&seed=42&waves=10&speed=8` 在 console 输出 `JSON:` 行后可直接拷贝粘贴喂给离线脚本
- ✅ 包体增量 < 2 kB

### 下一轮候选

1. **Node 端批量 benchmark** — 复用 perWave 字段，无浏览器跑 N seed × M 节点池 × K level，CSV 输出
2. **types.ts 中间层清理** — themes / renderer / entities 直接从 `data/*` 取常量，让 types 回归"纯类型"
3. **Phase B-3 时间盐** — 给信封 sig 加版本/时间戳盐，避免老存档备份在新版仍可读

---

## 14. Phase B-2 第三轮（2026-04-26 · Node 端批量 benchmark）

### 已完成

| commit | 主题 |
|--------|------|
| `732b317` | feat(bench): Node 端批量 benchmark 脚本（Playwright headless） |

### 设计

不直接在 Node 中跑 `Game`（其依赖 canvas / window / RAF / AudioContext，shim 成本过高），改为：

1. Node 子进程启动 `vite preview`，从 stdout 解析 Local URL
2. Playwright headless Chromium 顺序打开 N seed × M level 笛卡儿积，每个 page 用 `?bench=1` 触发 [src/benchmark.ts](../src/benchmark.ts) 流程
3. `page.waitForFunction(() => window.__benchResult)` 收割结果
4. 输出 CSV（汇总字段）+ 同名 .json（含 perWave 完整时序）

### 用法

```powershell
npm run bench:batch -- --seeds 1,2,3,4,5 --levels 1,2 --waves 10 --speed 8 `
  --nodes "energy,turret,mine,shield,relay" --out bench.csv --timeout 60000
```

输出：

- `bench.csv`：每行 `seed,levelId,targetWaves,speed,reachedWave,finalScore,totalTicks,finalNodeCount,finalEnemyCount,outcome,elapsedMs`
- `bench.json`：原 `args` + `runs[]` 含每条 perWave 时序，便于离线绘曲线
- console 末尾打印 `aggregate: avgScore / avgWave / won/gameover/reached_target` 计数

### 配套修复

实施过程中暴露并修复：

- **`src/tech.ts` 潜伏 bug**：`export { createTechTree } from './data/tech'` 是纯再导出，**不绑定本模块作用域**；同文件 `createTechState()` 内的 `createTechTree()` 调用在 Vite 产物里编译为裸标识符引用 → ReferenceError。改为 `import { createTechTree } from './data/tech'; export { createTechTree };`。
  - 普通玩家路径未触发是因为 LoginScreen 屏蔽了首屏 Game 构造；批量脚本触发的是 `?bench=1` 直进 Game 的路径，第一次曝出。
- **教程在 bench 模式自动跳过**：[src/benchmark.ts](../src/benchmark.ts) 在 `runBenchmark` 内 `localStorage.setItem('starfield_nodes_tutorial_done', '1')`，并在 poll 循环防御性 `state.paused = false`，避免 level 1 + 全新 profile 触发教程导致永久 paused。
- **Windows shell 启动子进程清理**：`spawn('npx.cmd', …, { shell: true })` 启动的进程要用 `taskkill /T /F` 杀整棵树，否则 vite preview 残留。

### 度量

| 项 | 值 |
|----|-----|
| 包体 | 164.16 kB / gzip 48.62 kB |
| 相对 §13 尾 | +2.03 kB |
| 增量来源 | tech.ts import 改写后多保留的 createTechTree 函数体（以前因再导出被 vite 单独保留，新写法被本模块直接引用） |
| Smoke | 5 seed × level 1 × 5 wave × speed 8 → 全部 reached_target、wall 8s/seed、约 40s 收完 |
| Smoke 决定性 | seed 1-3 节点数 30 / seed 4-5 节点数 29，tick 120 全到达 5 波（mulberry32 同 seed 100% 复现） |

### 退出标准

- ✅ Playwright + chromium 安装到 devDeps，npx 可调
- ✅ `npm run bench:batch` 一行命令跑完，CSV + JSON 落地
- ✅ Windows 下子进程在 success/error/Ctrl+C 路径都被 taskkill 清理
- ✅ console 错误（`createTechTree is not defined`）被发现并修复
- ✅ 同 seed 复跑结果一致，进入回归基线

### 下一轮候选

1. **types.ts 中间层清理** — themes / renderer / entities 直接 `import from 'data/*'`，types 回归纯类型层
2. **CI workflow** — GitHub Actions 在 PR 上跑 `bench:batch --seeds 1,2,3 --waves 5`，diff CSV 防止平衡参数偷偷漂移
3. **多节点池矩阵** — 脚本接 `--nodes-matrix "a,b,c|a,b,d"` 跑多种节点池组合，验证 COMBAT 表改动跨配置都不破坏
4. **CSV 聚合脚本** — node 端读 bench.json，按 level/wave 聚合 score/score-stddev，输出比较报告



## 15. Phase B-2 第四轮（2026-04-26 · CI 防护网 + 多节点池矩阵）

### 已完成

| commit | 主题 |
|--------|------|
| `e85c7c4` | ci(bench): GitHub Actions 回归防护网（bench-check.yml） |
| `edf0acb` | fix(ci): 放行 `scripts/bench-baseline.json` |
| `0b45473` | fix(bench): bench-batch 显式 `process.exit` + Linux SIGKILL 兜底 |
| (本次) | feat(bench): `--nodes-matrix` 多节点池矩阵 + 按 pool 聚合 |

### CI 回归防护网

- `.github/workflows/bench-check.yml`：push/PR main 触发，ubuntu-latest，timeout-minutes=5
- 步骤：checkout → setup-node 20（缓存 npm）→ 缓存 `~/.cache/ms-playwright` → `npx playwright install --with-deps chromium` → `npm run build` → `npm run bench:check`
- baseline = `scripts/bench-baseline.json`，仅卡 RNG-stable 字段：`outcome / reachedWave / totalTicks / finalNodeCount`
  - `finalScore / finalEnemyCount` 受 wall-clock dt 影响（`loop(timestamp)` 在 RAF 时序波动下命中数 ±1-2 漂移），不进卡点

### CI 挂死修复

首次 CI run（24949189569）实际 bench 25 秒跑完，但 Node 进程不退出，10 分钟超时。

- 根因：`vite preview` 子进程持有 stdio/socket 句柄，`preview.kill()` 在 Linux 上不必然让 event loop 退出
- 修复（bench-batch.mjs `main().finally`）：
  - Linux 路径：`preview.kill('SIGTERM')` → 500ms 后 `SIGKILL` 兜底
  - 全平台：`setTimeout(() => process.exit(process.exitCode ?? 0), 1000).unref()` 强制退出
- 二次 run（24949383391）1 分 10 秒通过 ✅

### 多节点池矩阵

新增 `--nodes-matrix "name1=a,b,c;name2=a,b,d"`：

- 与 `--nodes` 互斥；解析出 `[{name, nodes}]`
- 三重循环：`levels × pools × seeds`，每条 result 注入 `poolName` / `nodes`
- CSV 首列加 `poolName`；JSON `runs[]` 多两个字段
- 聚合输出：先全局 `avgScore/avgWave/won/gameover/reached_target`，`nodePools.length > 1` 时再按 pool 分组打印

本地实测（speed=8 / waves=5 / seeds=1,2 / 3 pools = 6 runs）：

| pool | nodes | seed1 score | seed2 score |
|------|-------|------------:|------------:|
| full | energy,turret,mine,shield,relay | 10 | 0 |
| noMine | energy,turret,shield,relay | 15 | 0 |
| turretOnly | energy,turret | 15 | 0 |

— 验证 mine 在 5 波短跑里不是必备（noMine 不输于 full），早期纯炮台 + 中继即可达成 reached_target。

### 下一轮候选

1. **CSV/JSON 聚合分析脚本** —— 读 bench.json，按 pool/wave 输出 score 均值/标准差/胜率曲线（markdown 表）
2. **types.ts 中间层清理** —— themes/renderer/entities 直接 `import from 'data/*'`
3. **更长矩阵基线** —— bench-baseline 扩展到 3 pools × 3 seeds，CI 也跑 9 个用例

## 16. Phase B-2 第五/六轮（2026-04-26 · 聚合分析 · CI 矩阵化 · types 中间层清理）

### 已完成

| commit | 主题 |
|--------|------|
| `1e72abf` | feat(bench): bench-analyze 聚合分析脚本（pool×wave 时序 + 稳定性表） |
| `adb3ee0` | ci(bench): 矩阵 baseline (3 pools × 3 seeds) + analyze 报告 + artifact 上传 |
| `486b49a` | refactor(types): 移除 NODE_CONFIGS/EDGE_CONFIGS/ENEMY_COLORS re-export 中间层 |

### bench-analyze 聚合脚本

- 入口：`npm run bench:analyze -- --in bench.json [--out report.md] [--no-perwave]`
- markdown 输出三段：
  1. **总览**：每 pool 的 n / outcome 计数 / avgScore±sd / avgWave±sd / avgTicks
  2. **时序**：每 pool × wave_end 的 avgScore±sd / avgEnemy / avgNodes / avgElapsedMs（基于 `perWave kind='wave_end'` 样本）
  3. **稳定性**：同 `pool+seed+level` 多次重复时 score 漂移与 wave/tick 一致性（仅当出现重复时）
- `stddev` 走 N-1 样本方差，0/1 样本退化为 0

### CI 矩阵基线

- baseline 升级到 9 runs（3 pools × 3 seeds）：
  - `full = energy,turret,mine,shield,relay`
  - `noMine = energy,turret,shield,relay`
  - `turretOnly = energy,turret`
- `bench-check.mjs` 透传 `--nodes-matrix`，索引键改 `pool|seed|level`
- `BENCH_KEEP=1` 让 CI 保留 `bench-ci.csv/json` 给后续 step
- workflow 新增 `Generate aggregate report` step：
  - `node scripts/bench-analyze.mjs --in bench-ci.json --out bench-report.md`
  - `cat bench-report.md >> `（PR 页面直接看每池得分曲线）
- artifact 改 `always()`，包含 `csv/json/md` 三件套
- timeout 5→8 分钟（9 runs Linux 实测 ~80s + 余量），实际 run **1m37s** 通过

### types.ts 中间层清理

types.ts 之前为兼容性沿用 `export { X } from './data/Y'`，曾导致 vite production
build 出现 ReferenceError（参见 §14 `tech.ts` 修复）。本轮一刀切：

- `src/types.ts` 删除 6 个 re-export（`NODE_CONFIGS / DEFAULT_NODE_GLOW / EDGE_CONFIGS / DEFAULT_EDGE_COLORS / ENEMY_COLORS / DEFAULT_ENEMY_COLORS`），改为注释指引
- 10 个调用方直接 `import from './data/{nodes,edges,enemies}'`：
  - `entities.ts / game.ts / graph.ts / input.ts / node-select.ts / particles.ts / renderer.ts / themes.ts / ui.ts`
- types.ts 回归纯类型 + 跨模块共享常量（`TICK_INTERVAL` 等）
- 体积：164.16 → 164.17 kB（+1 byte），gzip 48.62 → 48.58 kB（-40 byte）
- bench:check 9 runs 全过基线（RNG-stable 字段未变）

### 下一轮候选

1. **types.ts 二轮拆分** —— 把剩余的运行时常量（`TICK_INTERVAL / ENEMY_SPAWN_BASE_INTERVAL / EVOLUTION_LEVEL / EVOLVABLE_TYPES / EVOLUTION_NAMES`）拆到 `src/data/runtime.ts` / `src/data/evolution.ts`
2. **全量平衡报告** —— 跑 5 pools × 5 seeds × 10 waves，产出报告提交到 `doc/bench-reports/` 作为实验记录
3. **Phase E 继续** —— COMBAT 表覆盖剩余节点（已 13 个，还有 tesla/beacon/kamikaze 等）

## 17. Phase B-2 第七轮（types.ts 二轮拆分 + 全量平衡 sweep）

### 17.1 types.ts 二轮拆分（commit 67af240）

- 新增 src/data/runtime.ts：透传 alance.RUNTIME / ECONOMY 暴露 TICK_INTERVAL / MAX_EDGE_LENGTH / CORE_ENERGY_PRODUCTION / ENEMY_SPAWN_BASE_INTERVAL / TERRITORY_* / EXPAND_*
- 新增 src/data/evolution.ts：EVOLUTION_LEVEL / EVOLVABLE_TYPES / EVOLUTION_NAMES，getEvolutionCost / getEvolutionCrystalCost 转发到 alance.calc*
- src/types.ts 退化为纯类型/接口文件；顺带消除 getEvolutionCost 体内 NODE_CONFIGS 未导入的潜在 ReferenceError
- 5 个消费者（game/graph/input/renderer/ui）切换 import 路径
- build 164.57 KB，bench:check 9/9 OK

### 17.2 全量平衡 sweep（5 关 × 5 池 × 10 seed = 250 runs）

- 跑批：
ode scripts/bench-batch.mjs --seeds 1..10 --levels 1,2,3,4,5 --waves 5 --speed 8 --nodes-matrix "balanced=...;noMine=...;noShield=...;turretRush=...;shieldDefense=..." --out bench-full
- 报告：[doc/bench-report-full.md](bench-report-full.md)
- 结论摘要（waves=5 测试窗太短）：
  - 250/250 全部 reached_target，没有 won / gameover；avgNodes 始终 39.0 表明阵地零损耗
  - avgScore：balanced 5.8 > shieldDefense 3.1 > noMine 2.6 > turretRush 1.7 > noShield 1.6
  - sd 远大于均值（balanced sd=21.3）→ 击杀分布极度长尾，少数 seed 拿大头
  - 行动项：下一轮 sweep 应把 waves 提到 ≥15 并放开 timeLimit，让 gameover/won 真正发生才能比较 pool 强弱

## 18. Phase B-2 第八轮（加长 sweep waves=20）

- 跑批：5 pool × 5 关 × 5 seed = 125 runs，waves=20，speed=8×（耗时约 32 分钟）
- 报告：[doc/bench-report-long.md](bench-report-long.md)
- 结果：125/125 全部 gameover，avgWave≈8.69（即所有 pool 都倒在第 9 波附近）
- 按 pool avgWave 排名（差异极小）：
  - noMine 8.88 ≥ balanced 8.80 ≈ noShield 8.80 > turretRush 8.48 ≈ shieldDefense 8.48
- 按 pool avgScore：noShield 30.8 > shieldDefense 29.8 > balanced 26.0 > noMine 23.4 > turretRush 20.8（sd 仍长尾，~ 2-3× 均值）
- **关键发现**：
  - 当前默认 nodeCount/difficultyMult 下，第 9 波是死亡墙——5 个基础节点池都过不去
  - mine 拿掉反而 avgWave 略升（无 mine 时玩家攻击节点占比更高？或仅是噪声 ±1 波）
  - turret-only / shield-only 表现最差，验证"必须有打击+防御组合"
  - 行动项：要么调整难度曲线让玩家撑到 15 波，要么把 nodeCount 上限调高让阵地更大，再做 sweep