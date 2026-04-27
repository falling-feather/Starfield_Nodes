# 项目规划与长期优化路线（PROJECT ROADMAP）

> 更新时间：2026-04-27（V1.1.1 重写）  
> 主线：以**产品本体玩法体验**为核心，把基础设施类工作降级为支撑项；防作弊/防篡改等只在收益明显时按需推进。

---

## 1. 现状审视

### 1.1 已具备的能力

- **核心循环完整**：登录 → 选关 → 过场 → 节点选 → 战斗 → 失败/胜利反馈 已贯通
- **内容体量初步**：8 个关卡、20+ 节点类型、可研究科技树、成就系统、主题切换
- **产品化体验已补齐（V1.0.4-V1.1.0）**：
  - 暂停菜单（继续/重开/选卡/标题）
  - 失败重开直接回选卡
  - 节点按选择顺序绑定数字键 1-N
  - 科技树 + 主题面板支持鼠标交互
  - 模态焦点栈（上下键不再被画布抢占）
- **基础设施已就位**：
  - 节点/敌人/关卡/平衡参数集中到 `src/data/`（Phase B-1）
  - benchmark 框架 + seed 复现 + Node 端批量跑（Phase B-2）
  - 存档签名校验（Phase B-3，已上线但**不再投入更多精力**）
  - GitHub Pages 自动部署
- **历史调优记录可追溯**：§19–§36 多轮 bench A/B、§V0.x–§V1.1 提交档案保留在文档末尾

### 1.2 当前主要痛点（按玩家可感知排序）

1. **关卡内容偏少**：8 关在熟练玩家手中 30-60 分钟即通关，缺少长尾留存
2. **敌人多样性不足**：现有敌人主要是"血量×速度"组合，缺少机制性强的特殊单位
3. **节点之间的协同纵深较浅**：不少节点是单点产出/单点输出，缺少"组合解锁能力"的关系
4. **新手引导仅覆盖第 1 关**：第 2 关后没有结构化引导，进阶机制（领地折扣、超频、进化、连线类型）靠玩家自行摸索
5. **响应式与移动端**：只在 1280×720+ 桌面分辨率下完整可用，未做小屏适配
6. **声音与反馈层次薄**：胜负、研究、击杀的音效层次不分明，缺乏节奏感

### 1.3 已被降级或暂不展开的方向

- **存档反作弊**：当前 HMAC 签名足以挡住非主动改档玩家；进一步的服务器校验、混淆、反 devtools 收益小，**搁置**
- **观察性/调试 HUD**：已有 bench 工具足以诊断平衡问题，FPS 面板等工程向特性**仅在出现卡顿投诉时才做**
- **大规模重构**：`GameState` 单体偶有耦合，但当前迭代速度可接受，**暂不动**

---

## 2. 北极星目标（重排 · 6 个月视角）

按权重从高到低：

1. **玩法体验深化**：让"再玩一关"成为玩家自发选择，而非通关后流失
2. **新手到精通路径**：让玩家自然认知到核心机制（连线/超频/进化/科技），减少"我不知道还能干什么"
3. **内容产能**：单关从设计到上线的耗时缩短，让新关卡 / 新节点 / 新敌人迭代更快
4. **跨设备可玩**：至少桌面端 1024×600 起 + 移动端横屏可基础游玩
5. **可观测的稳定性**：版本回归 bug 不超过 1 个/版本，平台部署可靠

---

## 3. 分阶段路线图（V1.1.1 重排）

> 每个阶段都遵守元规则：**改完必须 build → preview → 浏览器 MCP 实测 → 文档同步**。

### Phase α（已完成）：产品化体验收敛

V1.0.4 / V1.0.5 / V1.0.6 / V1.1.0 已上线：暂停菜单、失败重开直进选卡、节点按序绑定、科技树鼠标 + 键 0、主题鼠标 + 焦点栈。详见文档末尾 §V1.0.4–§V1.1.0。

### Phase β（next，1-2 周）：玩法深化首批

#### 目标

让现有 8 关变得"耐玩"，给玩家提供至少一个"我下一局想试试这个流派"的钩子。

#### 任务

- **节点机制纵深**：选 3-4 个节点类型（候选：buffer / collector / interceptor / portal）写一组**联动机制**；例如 portal 解锁后两个 core 之间可建低成本远距连线
- **敌人机制分层**：新增 2-3 类机制型敌人：路径干扰（消除连线一段）、能量侵蚀（被攻击时偷资源）、反制流派（针对 turret 的护盾敌人）
- **关卡变体器**：从「生存/Boss/限时」三类目标扩展到「保护特定节点」「累计击杀」「资源限额」
- **关卡解锁可视化**：选关页显示每关的解锁条件 + 推荐流派
- **新手引导扩展**：第 2 关引导「连线类型选择」，第 3 关引导「超频」，第 4 关引导「进化」，第 5 关引导「科技树」

#### 验收

- 至少 1 关能通过 2 种以上流派通关（不是只有一条最优解）
- benchmark 在新机制下不出现 winrate < 30% 或 > 90% 的极端关卡

### Phase γ（2-4 周）：响应式与小屏可玩

#### 目标

把可用最小分辨率从 1280×720 降到 1024×600，并支持横屏移动端。

#### 任务

- HUD / 节点面板 / 科技树 / 暂停菜单走同一套断点（small / medium / large）
- 触屏手势：单指拖拽视野、双指缩放、长按节点 = 右键、菜单按钮放大命中区
- 文字缩放：根据 viewport 自动调字号档位
- 移动端 fallback：检测到 hover 不可用时把所有 hover 提示改为长按

### Phase δ（3-6 周）：内容生产工具链

#### 目标

降低单关 / 单节点 / 单敌人的上线成本。

#### 任务

- 关卡定义 hot reload：开发模式下修改 `src/data/levels.ts` 不刷新即生效
- 节点 / 敌人配置可视化校验脚本（npm run check-content）：自动跑一遍 spawn 是否平衡、节点造价是否在合理区间
- 自动生成 bench 矩阵：新关上线时跑一遍 8 套 seed，输出 winrate 报告

### Phase ε（持续）：稳定性 + 性能

仅在出现实际问题时才推进：
- 玩家投诉卡顿 → 先做调试 HUD 定位
- 出现一次大 bug → 才考虑写对应单测
- 不主动追加全量回归测试套件

---

## 4. 风险与应对

| 风险 | 应对 |
|---|---|
| 内容堆叠把核心循环搞复杂，新玩家流失 | 每加一个机制都要在第 1-3 关有"教学版"展示 |
| 移动端工作量超预期 | Phase γ 先做"可玩"，把"好看/好用"留给后续 |
| benchmark 在新机制下失效 | 每次新机制上线，必须同步更新对应 bench 场景 |
| 文档与代码失同步 | 沿用元规则 8：改动 PR 必须更新 ROADMAP 末尾 §V 章节 |

---

## 5. 跟进机制

- **每个 V 版本提交**：在文档末尾追加 §V{n} 章节，记录 背景 / 实现 / Web 验证表
- **每个 Phase 完成**：在第 1.1 节"已具备的能力"中刷新条目
- **优先级回顾**：当连续两个 V 版本都没推进 Phase β/γ 而在做 ε 类工作时，停下来重排

---

## 6. 已完成里程碑索引

历史实验性记录（保留作为档案，详细见对应章节）：

- §V0.1.0 / §V0.2.0 / §V0.6.0 / §V1.0.0：早期玩法成形与首个公开版本
- §V1.0.1 / §V1.0.2：工作区清理与文档归档
- §V1.0.3：线上关卡卡死修复（LEVELS 重导出陷阱）
- §V1.0.4 / §V1.0.5 / §V1.0.6 / §V1.1.0：8 项产品化优化
- §19–§36：Phase B-2 多轮 bench 调优（autoUpgrade / evolve / mineOutput / 养精兵）
- 早期 §1–§18：Phase A 收口、配置层抽离、bench seed 体系、存档签名等基础设施

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
- 报告：[doc/bench-reports/bench-report-full.md](bench-reports/bench-report-full.md)
- 结论摘要（waves=5 测试窗太短）：
  - 250/250 全部 reached_target，没有 won / gameover；avgNodes 始终 39.0 表明阵地零损耗
  - avgScore：balanced 5.8 > shieldDefense 3.1 > noMine 2.6 > turretRush 1.7 > noShield 1.6
  - sd 远大于均值（balanced sd=21.3）→ 击杀分布极度长尾，少数 seed 拿大头
  - 行动项：下一轮 sweep 应把 waves 提到 ≥15 并放开 timeLimit，让 gameover/won 真正发生才能比较 pool 强弱

## 18. Phase B-2 第八轮（加长 sweep waves=20）

- 跑批：5 pool × 5 关 × 5 seed = 125 runs，waves=20，speed=8×（耗时约 32 分钟）
- 报告：[doc/bench-reports/bench-report-long.md](bench-reports/bench-report-long.md)
- 结果：125/125 全部 gameover，avgWave≈8.69（即所有 pool 都倒在第 9 波附近）
- 按 pool avgWave 排名（差异极小）：
  - noMine 8.88 ≥ balanced 8.80 ≈ noShield 8.80 > turretRush 8.48 ≈ shieldDefense 8.48
- 按 pool avgScore：noShield 30.8 > shieldDefense 29.8 > balanced 26.0 > noMine 23.4 > turretRush 20.8（sd 仍长尾，~ 2-3× 均值）
- **关键发现**：
  - 当前默认 nodeCount/difficultyMult 下，第 9 波是死亡墙——5 个基础节点池都过不去
  - mine 拿掉反而 avgWave 略升（无 mine 时玩家攻击节点占比更高？或仅是噪声 ±1 波）
  - turret-only / shield-only 表现最差，验证"必须有打击+防御组合"
  - 行动项：要么调整难度曲线让玩家撑到 15 波，要么把 nodeCount 上限调高让阵地更大，再做 sweep

---

## §19. Phase E COMBAT 表三轮覆盖：beacon/buffer/collector + 散落硬编码全部归集（feat/combat #19）

### 目标

继续把 [src/graph.ts](../src/graph.ts) 中残留的"魔术数字"全部迁到 [src/data/balance.ts](../src/data/balance.ts) COMBAT.*，使 graph 函数变成"纯数据消费 + 流程控制"。本轮覆盖此前未进入 COMBAT 表的 3 个节点（beacon / buffer / collector）和已有节点的零散字段。

### 新增 COMBAT 表项

- rc.maxBounces / arc.decay（n/e/oc）
- lackhole.pullStrength（n/e/oc）+ closeDistance + closeDamageMult
- actory.evolvedSlowFactor
- sniper.splashDamageRatio
- eacon.energyCost
- uffer.range / boostPerLevel + ufferPulse.range / boostPerLevel / overchargeCapRatio
- collector.range / maxNearbyCap / evolvedOutputMult / crystalThreshold
- echo.proxyLevelScale / overchargeMult
- magnetEvolved.minPullDist

### 验证

- `npm run build` OK：`165.71 KB` / gzip `48.96 KB`（baseline 164.57 KB；+1.14 KB 来自新字段及 JSDoc）
- `npm run bench:check` OK：9/9 全部命中 baseline，PRNG 路径完全等价

### 仍硬编码的部分（待 §20+）

- getBaseSpeed 敌人速度表（应迁到 [src/data/enemies.ts](../src/data/enemies.ts) ENEMY_BASE_SPEED）
- 各节点 `case '...'` 里的能耗常量（`-2 / -5 / -8 / -12 / -15 / -20`），适合做 ENERGY_COSTS 字典
- `overchargeEnergyBroadcast` / `overchargeHealPulse` / `evolvedEnergyAssist` / `evolvedShieldArmor` 中的范围/治疗/阈值

---

## §19. Phase E COMBAT 表三轮覆盖：beacon/buffer/collector + 散落硬编码全部归集（feat/combat #19）

### 目标

继续把 [src/graph.ts](../src/graph.ts) 中残留的"魔术数字"全部迁到 [src/data/balance.ts](../src/data/balance.ts) `COMBAT.*`，使 graph 函数变成"纯数据消费 + 流程控制"。本轮覆盖此前未进入 COMBAT 表的 3 个节点（beacon / buffer / collector）和已有节点的零散字段。

### 新增 COMBAT 表项

- `arc.maxBounces / arc.decay`（n/e/oc）
- `blackhole.pullStrength`（n/e/oc）+ `closeDistance` + `closeDamageMult`
- `factory.evolvedSlowFactor`
- `sniper.splashDamageRatio`
- `beacon.energyCost`
- `buffer.range / boostPerLevel` + `bufferPulse.range / boostPerLevel / overchargeCapRatio`
- `collector.range / maxNearbyCap / evolvedOutputMult / crystalThreshold`
- `echo.proxyLevelScale / overchargeMult`
- `magnetEvolved.minPullDist`

### 验证

- `npm run build` OK：`165.71 KB` / gzip `48.96 KB`（baseline 164.57 KB；+1.14 KB 来自新字段及 JSDoc）
- `npm run bench:check` OK：9/9 全部命中 baseline，PRNG 路径完全等价

### 仍硬编码的部分（待 §20+）

- `getBaseSpeed` 敌人速度表（应迁到 [src/data/enemies.ts](../src/data/enemies.ts) `ENEMY_BASE_SPEED`）
- 各节点 `case '...'` 里的能耗常量（`-2 / -5 / -8 / -12 / -15 / -20`），适合做 `ENERGY_COSTS` 字典
- `overchargeEnergyBroadcast` / `overchargeHealPulse` / `evolvedEnergyAssist` / `evolvedShieldArmor` 中的范围/治疗/阈值


---

## §20. Phase E 续：能耗常量集中 ENERGY_COSTS + 敌人速度表迁移（refactor/energy #20）

### 目标

把 [src/graph.ts](../src/graph.ts) `processNodeEffects` 17 处 `currentEnergy -= 数字` 全部归集到 [src/data/balance.ts](../src/data/balance.ts) 的新字典 `ENERGY_COSTS`；同时把 `getBaseSpeed` switch 表迁到 [src/data/enemies.ts](../src/data/enemies.ts) 的 `ENEMY_BASE_SPEED` Record。

### 新增数据结构

- [src/data/balance.ts](../src/data/balance.ts) `ENERGY_COSTS`：17 个节点 × 形态消耗值，标量 / `{n,oc}` 二元结构
  - mine 5 / turret {10,15} / shield {8,12} / factory 15 / magnet 5 / repair {8,15} / sniper {12,20} / buffer {6,12} / collector 4 / interceptor {5,8} / radar 3 / portal 5 / blackhole 6 / echo 4 / toxin 3 / arc 4 / beacon 2
- [src/data/enemies.ts](../src/data/enemies.ts) `ENEMY_BASE_SPEED`：8 个敌人类型的基础速度 + `DEFAULT_ENEMY_BASE_SPEED = 2`
- 顺手清理：`COMBAT.beacon.energyCost` 删除（重复定义），唯一真理来源 = `ENERGY_COSTS.beacon`

### 受影响代码

- [src/graph.ts](../src/graph.ts) processNodeEffects 17 个 case：全部读 `ENERGY_COSTS.*`
- [src/graph.ts](../src/graph.ts) `getBaseSpeed` 由 9-case switch 折叠为单行 `ENEMY_BASE_SPEED[type] ?? DEFAULT_ENEMY_BASE_SPEED`
- 新增 import：`ENERGY_COSTS` from balance, `ENEMY_BASE_SPEED / DEFAULT_ENEMY_BASE_SPEED` from enemies

### 验证

- `npm run build` OK：`165.99 KB` / gzip `49.02 KB`（baseline 165.71 KB；+0.28 KB 仅注释/字段名）
- `npm run bench:check` OK：9/9 全部命中 baseline（outcome/reachedWave/totalTicks/finalNodeCount 完全一致）
- 数值等价性：所有数字逐一保留，无任何调整

### 还残留的硬编码（待 §21+）

- `overchargeEnergyBroadcast`：boost=10 / capRatio=1.2
- `overchargeHealPulse`：range=220 / heal=8 / energy=5 / threshold=0.5
- `evolvedEnergyAssist`：threshold=0.8 / boost=8
- `evolvedShieldArmor`：range=200 / heal=3
- energy 节点充能 (+3/+6) 与 tesla 节点充能 (+5)：归到 `ENERGY_GAINS` 字典


---

## §21. Phase E 收尾：shield/energy OC/EVOLVED 子字段 + ENERGY_GAINS 字典（refactor/combat #21）

### 目标

把 [src/graph.ts](../src/graph.ts) 中四个 OC/Evolved 专属函数（`overchargeEnergyBroadcast` / `overchargeHealPulse` / `evolvedEnergyAssist` / `evolvedShieldArmor`）残留的范围/治疗/阈值常量全部迁入 [src/data/balance.ts](../src/data/balance.ts) `COMBAT.shield` / `COMBAT.energy`；并新增 `ENERGY_GAINS` 字典与 `ENERGY_COSTS` 对偶，统一 energy/tesla 的 +N 充能数值。

### 新增/扩展数据

- `COMBAT.shield`：新增 `ocPulseRange / ocPulseHealPerLevel / ocPulseEnergyHeal / ocPulseStatusRestoreRatio / evolvedArmorRange / evolvedArmorHealPerTick`
- `COMBAT.energy`（首次出现）：`ocBroadcastBoost / ocBroadcastCapRatio / evolvedAssistThreshold / evolvedAssistBoost`
- `ENERGY_GAINS`：`energy: {n:3, e:6}` + `tesla: 5`

### 受影响代码

- [src/graph.ts](../src/graph.ts) `overchargeEnergyBroadcast`：boost/cap 改读 `COMBAT.energy.*`
- [src/graph.ts](../src/graph.ts) `overchargeHealPulse`：range/heal/energy/threshold 改读 `COMBAT.shield.ocPulse*`
- [src/graph.ts](../src/graph.ts) `evolvedEnergyAssist`：threshold/boost 改读 `COMBAT.energy.evolvedAssist*`
- [src/graph.ts](../src/graph.ts) `evolvedShieldArmor`：range/heal 改读 `COMBAT.shield.evolvedArmor*`
- [src/graph.ts](../src/graph.ts) processNodeEffects：energy/tesla case 改读 `ENERGY_GAINS.*`

### 验证

- `npm run build` OK：`166.58 KB` / gzip `49.21 KB`（baseline 165.99 KB；+0.59 KB 仅 JSDoc/字段名）
- `npm run bench:check` OK：9/9 全部命中 baseline，数值完全等价

### Phase E 阶段完成里程碑

至此 [src/graph.ts](../src/graph.ts) 内已无任何"无名魔术数"参与战斗判定，全部数值均来自 [src/data/balance.ts](../src/data/balance.ts)（COMBAT/ECONOMY/RUNTIME/OVERCHARGE/ENERGY_COSTS/ENERGY_GAINS/ENEMY_DEATH_REWARDS）+ [src/data/enemies.ts](../src/data/enemies.ts) `ENEMY_BASE_SPEED`。下一阶段（Phase F）可专注：
- 数值调优（针对第 9 波死亡墙）
- benchmark 报告解析与 perWave 曲线可视化
- 玩家可见 UI/UX 与 mod-ability


---

## §22. 第 9 波死亡墙诊断（doc/death-wall-wave9.md）

### 输入

[doc/bench-reports/bench-report-long.md](./bench-reports/bench-report-long.md) 的 5 pool × 25 run 时序聚合表。

### 关键发现

- **死亡墙位置高度收敛**：5 pool 的 avgWave 全部落在 8.48–8.88，标准差仅 ~1.1；wave 8→9 存活率从 ~70% 跌到 ~25%
- **enemy/node 比率**：wave 5 = 0.80（玩家可控）→ wave 6 = 1.26（首次被压制）→ wave 9 = 2.60（崩溃）
- **节点增长被卡死**：wave 1→8 共 7 波只 +4 个节点（38.8→42.9），主要受**前 6 波几乎不杀敌（avgScore<10）→ 资源积累不足**约束
- **spawn 曲线斜率过陡**：Δenemy 在 wave 5→6 突然从 +10 跳到 +18（+80% 增量），wave 7→8 +24（+41% 增量）
- **shield pool 不优于 noShield**（avgWave 反而少 0.32）：当前 shield 治疗输出远低于敌人 DPS，护盾纵深无法形成

### 诊断结论

不是某 pool 的问题，而是**全局难度曲线**：spawn 中期曲线过激进 + 玩家资源积累不足 + DPS 增长存在阈值现象（够 / 不够，无渐进性）。

### 调优建议优先级

1. **降低 wave 6–9 spawn 增量斜率**（高，预期效果：wave 9 enemy/node 2.60→1.8）
2. **提高中前期资源积累速度**（高，预期效果：wave 7-8 nodeCount +5~10）
3. **shield 节点强化**（中，让 shieldDefense 成为可行策略）
4. **boss 出现时机延后**（中）
5. **bench-report 新增 kills/spent/built 字段**（低，结构性观测改善）

### 行动项（写入 §23+）

- 对比 A/B：先归档当前 long sweep 为 baseline，应用调优 1+2 后重跑加长 sweep，目标 avgWave ≥ 12


---

## §23. 平衡调优 ①+② A/B 对比：spawn 斜率减缓 + mine 产出翻倍（feat/balance #23）

### 背景

§22 诊断报告 [doc/death-wall-wave9.md](death-wall-wave9.md) 给出 5 项调优建议，本轮按优先级实施 ①+②：

- **①**：把 spawn 数量公式 `1 + floor(wave/3)` 改成 `1 + floor(wave/4)`，缓解 wave 5→6 那一次 +80% 的人数跳变
- **②**：把 mine 节点基础产出 `2/tick`（OC `4/tick`）改成 `3/tick`（OC `6/tick`），让玩家在 wave 5-9 的资源积累追上敌人血量曲线

### 代码改动

[src/data/balance.ts](../src/data/balance.ts)

```ts
ECONOMY = {
  // 既有：startCrystal, expandCrystalCost, ...
  mineOutputBase: 3,        // §23 调优 ②（原 2）
  mineOutputOvercharge: 6,  // §23 调优 ②（原 4）
};

RUNTIME = {
  // 既有 ...
  enemySpawnCountDivisor: 4, // §23 调优 ①（原 3）
};
```

[src/entities.ts](../src/entities.ts) — `spawnEnemy`：

```ts
const count = 1 + Math.floor(wave / RUNTIME.enemySpawnCountDivisor);
```

[src/graph.ts](../src/graph.ts) — `case 'mine'`：

```ts
let output = (oc ? ECONOMY.mineOutputOvercharge : ECONOMY.mineOutputBase) * node.level;
```

### A/B sweep 结果

基线归档：[doc/bench-reports/bench-report-long-pre-balance.md](bench-reports/bench-report-long-pre-balance.md)（HEAD `aa3a35b`，§22 诊断时刻）

调优后：[doc/bench-reports/bench-report-long-tuned.md](bench-reports/bench-report-long-tuned.md)（本节）

**总览对比**：

## 总览对比表

| pool | 基线 avgWave | 调优 avgWave | Δ | 基线 avgScore | 调优 avgScore |
|------|-------------:|-------------:|--:|--------------:|--------------:|
| balanced | 8.80 | 9.00 | +0.20 | 26.0 | 21.0 |
| noMine | 8.88 | 9.16 | +0.28 | 23.4 | 21.8 |
| noShield | 8.80 | 9.00 | +0.20 | 30.8 | 34.2 |
| turretRush | 8.48 | 9.04 | **+0.56** | 20.8 | 23.0 |
| shieldDefense | 8.48 | **9.40** | **+0.92** | 29.8 | 27.6 |
| **整体** | **8.69** | **9.12** | **+0.43** | 26.2 | 25.5 |

## 关键 wave 对比（balanced pool 为例）

| wave | 基线 avgEnemy | 调优 avgEnemy | Δ% | 基线 存活 n | 调优 存活 n |
|-----:|--------------:|--------------:|----|-----------:|-----------:|
| 4 | 20.9 | 17.0 | -19% | 25 | 25 |
| 5 | 30.8 | 27.0 | -12% | 25 | 25 |
| 6 | 48.7 | 38.9 | **-20%** | 25 | 25 |
| 7 | 66.4 | 50.7 | -24% | 21 | 24 |
| 8 | 90.2 | 74.4 | -18% | 17 | 16 |
| 9 | 115.2 | 94.0 | -18% | 6 | 8 |
| 10 | 154.0 | 119.5 | -22% | 1 | 2 |

## 显著变化

- spawn 减缓有效：每波敌人数 -18% ~ -24%（与公式 `1+wave/4` vs `1+wave/3` 的理论降幅 -25% 在 wave 9 处吻合）
- 死亡墙位置整体右移 ~0.5 波：基线 6 runs 撑到 wave 9，调优后 8 runs；balanced wave 10 从 1 → 2 runs
- **首个 won 出现**：turretRush pool 1/25 通关（基线 0/25）
- shieldDefense 提升最大（+0.92 wave），有 1 run 撑到 wave 11
- noMine pool avgWave 反而最高 9.16（mine 增产对存活贡献低于预期，因为玩家在死亡墙阶段水晶根本花不出去）

## Verdict

- ✅ spawn 调缓 + mine 增产生效，每波敌人 -20%、avgWave +0.43
- ✅ 首次出现通关（turretRush pool）
- ❌ 远未达 §22 设定的 "avgWave ≥ 12" 目标，整体仍 9.12，死亡墙只右移半波
- 📌 mine 增产对死亡墙意义有限（noMine 反超），瓶颈仍在战斗端
- 📌 下一步必须加 **③ shield 强化** 与 **④ boss 推迟**，单纯减 spawn / 加资源不够


### 验证

- `npm run build` OK：`166.70 KB`
- `npm run bench:check` OK：9/9 全部 outcome / reachedWave / totalTicks / finalNodeCount 一致；唯一变化在 finalEnemyCount（21→17，符合 spawn 减少预期）
- 长 sweep 125 runs 完整执行（5 seeds × 5 levels × 5 pools，waves=20，speed=8）

### 结论

见上 ## Verdict 段。整体方向正确但幅度不足；建议下一轮立即上 ③+④。

### 下一步候选

- ③ shield 强化：`baseHealth ×1.5`、`armorBoost +1`
- ④ boss 出现波次推迟（wave ≥ 10 才出 boss 或降低 boss 血量曲线斜率）
- ⑤ bench instrumentation：perWave 增加 `kills/spent/built` 字段，便于精细分析

## §24. 平衡调优 ③+④ A/B 对比：shield 强化 + boss 推迟（feat/balance #24）

### 目标
继 §23 之后，按 §22 诊断剩余建议执行 ③ 和 ④：
- ③ shield 强化：节点 `maxHp 200 → 300`（×1.5），`COMBAT.shield.evolvedArmorHealPerTick 3 → 4`。
- ④ boss 出现波次推迟：level 3 `bossWave 15 → 18`，level 6 `bossWave 20 → 22`。

诚实声明：长 sweep 测试 levels 1-5，其中只有 level 3 有 boss（其余 `hasBoss=false`）；④ 在 sweep 中影响面有限，主要观察 level 3 的死亡墙是否右移。

### 代码改动
- [src/data/nodes.ts](src/data/nodes.ts)：`shield.maxHp 200 → 300`。
- [src/data/balance.ts](src/data/balance.ts)：`COMBAT.shield.evolvedArmorHealPerTick 3 → 4`。
- [src/data/levels.ts](src/data/levels.ts)：level 3 `bossWave 15 → 18`、level 6 `bossWave 20 → 22`。

### A/B sweep 结果（vs §23 baseline）
seeds=1-5 levels=1-5 waves=20 speed=8× 5 个 pool 共 125 runs。

| pool | §23 avgWave | §24 avgWave | Δ | §23 won | §24 won |
|------|-----------:|-----------:|--:|-------:|-------:|
| balanced      | 9.16 | 9.36 | +0.20 | 0 | 0 |
| noMine        | 9.16 | 9.36 | +0.20 | 0 | 1 |
| noShield      | 9.20 | 9.24 | +0.04 | 0 | 0 |
| turretRush    | 9.04 | 9.24 | +0.20 | 1 | 0 |
| shieldDefense | 9.04 | 9.24 | +0.20 | 0 | 1 |
| **整体**      | **9.12** | **9.29** | **+0.17** | **1** | **2** |

详见 [doc/bench-reports/bench-report-long-tuned2.md](doc/bench-reports/bench-report-long-tuned2.md)。

### Verdict
- 死亡墙整体再右移 ~0.17 波，方向正确但幅度有限。
- 总 won 翻倍（1 → 2），noMine + shieldDefense 各破 1，验证 shield 强化对阵地流有效。
- noShield pool 几乎不变（+0.04），间接确认 ③ 的提升来源于 shield 节点而非全局效应。
- 距 §22 目标 `avgWave≥12` 仍差距明显；spawn/护盾路线收益已逐步衰减，下一轮应转向 instrumentation 或经济/单位上限调整。

### 验证
- `npm run build`：166.70 KB OK。
- `npm run bench:check`：9/9 OK（baseline 已随 §23 锁定，§24 不变更短 sweep 输出口径）。

### 下一步候选
- ⑤ bench instrumentation：`perWave` 增加 `kills/spent/built` 字段，便于精细分析瓶颈。
- 或：探索新调优方向（如 `nodeCount` 上限、能源传导效率）。
## §25. Bench instrumentation：perWave 增加 kills/built/spent 字段（feat/bench #25）

### 目标
按 §22→§24 演进路径的剩余建议 ⑤ 实施：`BenchWaveSample` 增加三个累计字段：
- `kills`：局内累计击杀数
- `built`：局内累计玩家建造节点数
- `spent`：局内累计资源花费

为后续精细诊断（击杀效率/经济利用率）提供数据基础。

### 代码改动
- [src/types.ts](src/types.ts)：`GameState` 新增 `enemiesKilled / nodesBuilt / resourcesSpent` 三字段（局内单调递增计数）。
- [src/game.ts](src/game.ts)：`createInitialState` / `restart` 初始化三字段；敌人减少时同步累加 `state.enemiesKilled`。
- [src/input.ts](src/input.ts)：`placeNode` 成功放置时累加 `state.nodesBuilt += 1` 与 `state.resourcesSpent += cost`。
- [src/benchmark.ts](src/benchmark.ts)：`BenchWaveSample` 增加 `kills/built/spent`，`wave_end` 与 `final` 样本均写入。
- [scripts/bench-analyze.mjs](scripts/bench-analyze.mjs)：旧报告无字段时回落原列；新报告输出 8 列时序表。

### 长 sweep 关键洞察
seeds=1-5 levels=1-5 waves=20 speed=8× × 5 pool 共 125 runs（[doc/bench-reports/bench-report-long-instr.md](doc/bench-reports/bench-report-long-instr.md)）。

整体 avgWave 9.04（与 §24 同量级，PRNG 噪声范围内），但新字段揭示**击杀效率严重不足**：

| pool | wave 8 avgEnemy | wave 8 avgKills | kill/enemy |
|------|---------------:|---------------:|----------:|
| balanced      | 74.3 | 0.7  | **0.9%** |
| noMine        | 73.9 | 1.1  | 1.5% |
| noShield      | 73.9 | 1.1  | 1.5% |
| turretRush    | 73.4 | 1.6  | 2.2% |
| shieldDefense | -    | -    | - |

**注**：bench 是 headless 自动跑，无玩家操作 → `built/spent` 全 0（这本身就是 instrumentation 揭示的 bench 局限：仅评估初始节点战斗力，不评估建造决策）。但 `kills` 字段揭示了真正的瓶颈：**初始 turret 的 DPS 远低于 spawn 速率**，wave 7-8 的死亡墙根本原因不是护盾不够，而是**攻击端火力严重不足**。

### Verdict
- §25 instrumentation 已落地；旧报告兼容回落。
- 数据反向支持：之前 §23 spawn 减缓 / §24 shield 强化收益逐步衰减的根因 = 攻击 DPS 跟不上敌方累计血量。
- 下一轮 §26 应聚焦 **turret DPS / 范围 / overcharge 收益**，而不是继续护盾或 spawn。

### 验证
- `npm run build`：167.04 KB OK（+0.34 KB，三字段开销）。
- `npm run bench:check`：9/9 OK（baseline 锁定字段未变）。
- 1×1 小 sweep 验证 `perWave` 中 `kills/built/spent` 字段写入正确。

### 下一步候选
- §26 转向 turret DPS 提升（基础伤害/射速/范围其一调优）。
- 或：增加 bench mode 模拟简单玩家行为（基于剩余资源自动建造），让 `built/spent` 也有意义。
---

## §26 · turret DPS 单一调优 A/B（负结果）

### 目标
基于 §25 instrumentation 揭示的 wave 7-8 kill rate <2% 死亡墙，调优 turret 攻击端：
- `rangeBase` 180 → **200**（+11%，缩短盲区）
- `damageBase` 15 → **22**（×1.47，预期 DPS +47%）

单文件改动：`src/data/balance.ts` `COMBAT.turret`。

### A/B 对照（vs §25 same sweep params）

| pool | §25 avgWave | §26 avgWave | Δ | §25 wave8 avgKills | §26 wave8 avgKills | Δ |
|------|------------:|------------:|--:|-------------------:|-------------------:|--:|
| balanced | 9.36 | 9.08 | -0.28 | 1.6 | 1.7 | +0.1 |
| noMine | 9.08 | 9.20 | +0.12 | 1.3 | 1.3 | 0 |
| noShield | 9.28 | 9.04 | -0.24 | 1.2 | 1.2 | 0 |
| turretRush | 9.08 | 9.20 | +0.12 | 1.0 | 1.1 | +0.1 |
| shieldDefense | 8.96 | 9.20 | +0.24 | 1.0 | 1.1 | +0.1 |

### Verdict（关键负结果）
**+47% DPS 调优在 bench 中几乎无效**。原因：
1. headless bench 无玩家操作 → 全程 `level 1` turret，无升级、无 overcharge、无 evolve；
2. 敌人 HP 按 wave 指数缩放，wave 8 `HP ≈ 100+`，level-1 turret 单发 22 仍需多发；
3. spawn count = `1 + floor(wave/4)`（§23），wave 8 = 3/spawn；同时敌人速度也涨；
4. 真正瓶颈不是 `damageBase` 单参数，而是 **节点升级路径** + **能量循环** 的耦合。

### 后续候选
- A. `§27` 给 bench 增加 **auto-upgrade 策略**（每 30s 把资源花在升级最强 turret），让 bench 反映"会玩"的玩家；
- B. `§27` 调整 `damageMult` per-level scaling，使 level 1→2 收益更大；
- C. `§27` 降低敌人 HP 缩放系数（敌强减弱方向）；
- D. `§26.1` 回滚本次改动，因为 manual-play 体感未验证。

### 验证
- `npm run build` 167.04 KB OK
- `npm run bench:check` 9/9 OK（baseline 不含 score/kills，无漂移）
- 长 sweep 125 runs 完成，报告 [doc/bench-reports/bench-report-long-turret.md](doc/bench-reports/bench-report-long-turret.md)
---

## §27 · bench auto-upgrade 策略（会玩玩家模型）

### 目标
§26 暴露的 bench 局限：headless 全程 level-1 节点，敌人 HP 按 wave 缩放，单参数调优在 bench 中无效。  
解决方案：bench 模式新增 `--auto-upgrade` 选项，模拟"会玩"玩家每秒尝试把资源花在升级上，让 bench 反映 `level-up` 循环耦合。

### 代码改动
- `src/benchmark.ts`
  - `BenchParams` 新增 `autoUpgrade: boolean`
  - `parseBenchParams` 解析 `?autoUpgrade=1`，**默认 off**（保持 §22-§26 baseline 可复现）
  - 新增 `tickAutoUpgrade(state)`：贪心遍历 `connected && level < EVOLUTION_LEVEL` 节点，按优先级 `turret > shield > 其它` + level ASC 升级，资源不够即停
  - poll 循环每 60 tick（约 1s @60fps）调用一次
  - 直接修改 `state.resourcesSpent` 让 spent 字段也有意义
- `scripts/bench-batch.mjs`：新增 `--auto-upgrade` flag → URL 加 `&autoUpgrade=1`

### A/B 对照（vs §26 same sweep params）

| pool | §26 avgWave | §27 avgWave | Δ | §26 wave8 avgKills | §27 wave8 avgKills | Δ |
|------|------------:|------------:|--:|-------------------:|-------------------:|--:|
| balanced | 9.08 | 9.48 | **+0.40** | 1.7 | 3.9 | **×2.3** |
| noMine | 9.20 | 9.32 | +0.12 | 1.3 | 3.5 | ×2.7 |
| noShield | 9.04 | 9.16 | +0.12 | 1.2 | 3.6 | ×3.0 |
| turretRush | 9.20 | 9.40 | +0.20 | 1.1 | 3.4 | ×3.1 |
| shieldDefense | 9.20 | 9.64 | **+0.44** | 1.1 | 3.6 | ×3.3 |

### Verdict
1. **wave 8 kill rate 从 ~1.5% 提升至 ~5%**，但仍是死亡墙；
2. avgWave 边际涨 0.1-0.4，说明 `level-up` 收益真实存在但 wave 9-10 的指数 spawn 仍压垮升级速度；
3. `avgSpent` wave 8 时 245-276 = ~6-9 次升级，bench 现在能反映"建造经济"维度；
4. 5 pool 间差异缩小（balanced 不再独尊），说明在"会玩"模型下策略多样性更好；
5. **§26 turret +47% DPS 改动现在显得过于激进且无差异化**；下一步可考虑 §28 回滚 §26 + 调升敌人 HP 上限。

### 验证
- `npm run build` 167.69 KB OK（+650B）
- `npm run bench:check` 9/9 OK（autoUpgrade 默认 off，baseline 不漂移）
- smoke 3-run autoUpgrade=1：seed=1 won wave 11 kills=29 spent=300，验证机制工作
- 长 sweep 125 runs 完成，报告 [doc/bench-reports/bench-report-long-au.md](doc/bench-reports/bench-report-long-au.md)

### 下一步候选
- A. `§28` 回滚 §26 turret 改动（damageBase 22→15, rangeBase 200→180），用 autoUpgrade 重测，确认 §26 是否伪改进
- B. `§28` 调整敌人 HP 上限（现 wave 8 kill rate 5% 仍嫌低），让 wave 8-12 更可达
- C. `§28` 把 `--auto-upgrade` 加进 `bench:check` baseline 做双轨防回归
- D. 暂停
---

## §28 · §26 turret 数值在 autoUpgrade 下的 A/B 验证

### 目标
§26 在无升级 bench 中显得无效（负结果）。§27 引入 autoUpgrade 后重新做 A/B：
- variant: rangeBase=180, damageBase=15（§25 数值）+ autoUpgrade
- baseline: rangeBase=200, damageBase=22（§26 数值）+ autoUpgrade

### 实验配置
- seeds=1..5, levels=1..3, waves=15, speed=8, nodes=balanced, autoUpgrade=on
- 共 15 runs / variant

### 结果对比

| metric | §25 (180/15) | §26 (200/22) | Δ |
|--------|-------------:|-------------:|--:|
| avgKills | 1.80 | **2.33** | **+30%** |
| avgScore | 33.3 | **46.0** | **+38%** |
| avgWave | 9.67 | 9.47 | -0.20 |
| won | 1/15 | 1/15 | 0 |

### 浏览器 MCP 实测交叉验证（seed=1, level=1）
- §26 (200/22) + autoUpgrade: won wave 11, score 520, kills 33, spent 300
- §25 (180/15) baseline 数据见 \ench-au-v25.json\

### Verdict
**§26 数值在 autoUpgrade 模式下显著有效**（+30% kills / +38% score），与 §26 commit 的"负结果"标签矛盾。
- 根因：§26 sweep 用 autoUpgrade=off，turret 永远 level 1，`damage = 15×1 vs 22×1` 在 wave 8+ 敌人 HP 100+ 下都打不穿；
- autoUpgrade 启用后 turret 升到 level 5+，`damage = 15×5 vs 22×5` 差异从 7 拉到 35，DPS 优势放大；
- avgWave -0.20 是噪声（n=15）或 autoUpgrade 偏好 turret 升级排挤 shield 的副作用。

**决策**：保留 §26 turret 数值不回滚。今后 bench A/B 应**始终带 autoUpgrade**。

### 验证手段
- `npm run build` 167.69 KB OK
- `npm run bench:check` 9/9 OK（baseline 不漂移）
- 浏览器 MCP（`open_browser_page` + `run_playwright_code`）端到端 VICTORY 截图
- 报告产物 [bench-au-v25.json](../bench-au-v25.json) / [bench-au-v26.json](../bench-au-v26.json)（gitignored）

### 工程教训
1. **bench A/B 必须模拟"会玩"行为**，否则升级敏感的改动全显示无效；
2. `commit message 标注"负结果"应留待复核`——§26 commit 标注了负结果但实际有效；
3. 浏览器 MCP 端到端验证应作为 sweep 的常规配套，确认渲染/状态机/数据三者一致；
4. `§27 autoUpgrade` 是 bench 体系的**关键基础设施升级**，回溯使过去 §23-§26 的部分诊断结论需要重测。

### 下一步候选
- A. `§29` autoUpgrade 模式下重做 §22-§26 全部 A/B，校正诊断结论；
- B. `§29` 给 autoUpgrade 加 evolve 阶段（level 满后买 evolve），看能否冲过 wave 11 上限；
- C. `§29` autoUpgrade 同时加 build 阶段（用资源在空槽位放 turret），完整模拟玩家；
- D. `§29` 调整 autoUpgrade 优先级（mine 优先早期，turret 后期），看是否更优。
---

## §29 · autoUpgrade 下重测 §22-§24 诊断结论

### 目标
§28 揭示"bench A/B 必须带 autoUpgrade"。本节用 autoUpgrade 重测 §22-§24 各项调优是否依然有效。

### 实验配置
- baseline = bench-au-v26（§22-§28 全开 + autoUpgrade）：avgScore=46.0, avgWave=9.47, won=1/15
- 每个 variant 反转单个 knob，其它保持 baseline 一致
- seeds=1..5, levels=1..3, waves=15, speed=8, autoUpgrade=on, n=15 / variant

### 结果汇总

| variant | knob 反转 | avgScore | avgWave | won | Δscore | Δwave |
|---------|-----------|---------:|--------:|----:|-------:|------:|
| baseline (§28) | 当前 | 46.0 | **9.47** | 1 | – | – |
| §29.1 spawn | enemySpawnCountDivisor 4→2 | 51.7 | **8.27** | 0 | +12% | **-1.20** |
| §29.2 mine | mineOutputBase 3→2, OC 6→4 | 35.7 | 9.47 | 1 | -22% | 0 |
| §29.3 shield | shield maxHp 300→200 | 40.0 | 9.47 | 1 | -13% | 0 |

### 逐项 Verdict

#### §23 spawn divisor（÷2 → ÷4）→ **依然高度有效**
- avgWave 8.27→9.47 (+1.2)，won 0→1
- spawn 减半直接降低敌人压力，是 §22-§24 中**唯一对生存波数有显著影响**的改动
- **保留**

#### §23 mine 增产（2/4 → 3/6）→ **生存维度边际为零，score 维度有效**
- avgWave/won 完全相同
- avgScore -22% 来自资源吞吐变化（autoUpgrade 升级花费下降时收益堆积）
- 原因：autoUpgrade 启动后 turret/shield 都升到 level 5，资源稀缺度大幅降低
- **保留**（不影响生存但有 score 区分度，且对 manual play 早期有意义）

#### §24 shield maxHp（200 → 300）→ **autoUpgrade 下边际几乎为零**
- avgWave/won 完全相同，avgScore 仅 -13%
- 根因：autoUpgrade 把 shield 升到 level 5 → `maxHp = base × (1 + 5×0.25) = base×2.25`，base 100 差异在乘法后被掩盖
- **保留**（manual play 早期 level-1 shield 仍是 200→300 的差异，对教学/低水平玩家有意义）

### 浏览器 MCP 复核
未做单独浏览器复核——bench-au-v26 已在 §28 用浏览器确认正确性，且 §29.1-3 仅改单个常量，渲染层无影响。

### 验证
- 每次 variant 后 `git diff` 确认仅单参数改动
- 最终恢复后 `npm run build` 167.69 KB OK
- `npm run bench:check` 9/9 OK
- 报告产物：bench-au-29-1-spawn / -2-mine / -3-shield (.json/.csv，gitignored)

### 工程教训
1. **§22 死亡墙诊断的根因排序需要修正**：spawn (×) >> turret DPS (autoUpgrade 后) >> mine ≈ shield
2. autoUpgrade 改变了所有 base-stat 调优的相对收益——后期 level 缩放主导
3. **manual play 与 autoUpgrade 是两个不同的优化目标**：base stat 改动对 manual play 仍重要
4. 未来 base-stat A/B 应同时跑 `--auto-upgrade off` 和 `--auto-upgrade on` 双版本

### 下一步候选
- A. `§30` autoUpgrade 加 evolve 阶段，看能否冲过 wave 11
- B. `§30` 双版本 A/B 框架（autoUpgrade on/off 同时跑）
- C. `§30` 调整 `upgradeBaseCost / upgradeEnergyGrowth / upgradeHpGrowth` 三个 level 缩放参数
- D. `§30` 给 enemy 加 wave 8+ 难度上调（现在死亡墙太硬，玩家无技巧空间）
---

## §30 · 双版本 AB 框架（autoUpgrade off vs on 并排）

### 目标
§29 教训"未来 base-stat A/B 应同时跑 autoUpgrade on/off"。本节给 bench-batch 增加 `--ab-autoupgrade` 模式，每个 (seed,level,pool) 自动跑两次并排输出。

### 代码改动（仅工具链，无游戏逻辑改）
**[scripts/bench-batch.mjs](scripts/bench-batch.mjs)**：
1. 新增 `--ab-autoupgrade` flag
2. 主循环加 `auModes` 维度，AB 模式时每 (seed,level,pool) 跑 `[off, on]` 两次
3. 每个 result 加 `autoUpgrade` 字段（0/1），写入 CSV/JSON
4. CSV header 加 `autoUpgrade` 列
5. 聚合阶段新增 AB 对比段：`[autoUpgrade=off] / [autoUpgrade=on]` + 每 pool `off:... | on:...` 一行

### 验证 sweep（54 runs = 3 seeds × 3 levels × 3 pools × 2 AB）

\\\
[autoUpgrade=off] n=27 avgScore=40.9 avgWave=9.11 won=3
[autoUpgrade=on ] n=27 avgScore=62.6 avgWave=9.07 won=3
\\\

| pool | off avgScore | on avgScore | Δ |
|------|-------------:|------------:|--:|
| balanced | 37.2 | 61.1 | **+64%** |
| noShield | 44.4 | 59.4 | +34% |
| turretRush | 41.1 | 67.2 | **+63%** |

### 关键发现
- autoUpgrade 平均带来 **+53% avgScore**，但 **avgWave 不变** (9.07-9.11)
- `won` 数也不变（3/27 vs 3/27）→ **autoUpgrade 不能突破 wave 11 死亡墙**
- 死亡墙真正的瓶颈是 evolve 阶段缺失 + enemy wave 8+ HP 缩放
- pool 间 Δ% 差异（noShield 仅 +34% 远低于其它）→ shield 升级被 autoUpgrade 优先级低估？

### 验证
- `node -c scripts/bench-batch.mjs` 语法 OK
- `npm run build` 167.69 KB OK
- `npm run bench:check` 9/9 OK（默认 off，CSV 列变化不影响 JSON 比对）
- smoke test (4 runs) 与 validate sweep (54 runs) 双 size 验证

### 下一步候选
- A. `§31` 调整 autoUpgrade 优先级（shield 提前？mine 提前？），用 AB 框架快速验证
- B. `§31` 加 evolve 阶段到 autoUpgrade，冲过 wave 11
- C. `§31` enemy wave 8+ 难度系数下调（让玩家有反应空间）
- D. `§31` bench-analyze 也支持 AB（生成 markdown 报告）
---

## §31 · autoUpgrade 加 evolve 阶段

### 目标
§30 揭示 wave 11 死亡墙。猜测是 evolve 缺失（玩家手动会 evolve，autoUpgrade 不会）。本节给 `tickAutoUpgrade` 加二阶段：升级完后，扫描 `level >= 5 && !evolved && EVOLVABLE` 节点，消耗 `getEvolutionCost + getEvolutionCrystalCost` 触发进化（maxEnergy/maxHp ×1.5）。

### 代码改动
**[src/benchmark.ts](src/benchmark.ts)** `tickAutoUpgrade`：
1. import 加 `EVOLVABLE_TYPES, getEvolutionCost, getEvolutionCrystalCost`
2. 升级 while 循环 `return → break`（确保进入二阶段）
3. 新增二阶段：filter 已满级未进化的 EVOLVABLE，按 prio 排序，能 evolve 就 evolve
4. evolve 同时累加 `state.resourcesSpent`

### 验证 sweep（54 runs, 同 §30 配置）
\\\
[autoUpgrade=off] n=27 avgScore=43.7 avgWave=9.07 won=3
[autoUpgrade=on ] n=27 avgScore=63.1 avgWave=9.33 won=3
\\\

### 对比 §30 vs §31（autoUpgrade=on）
| 指标 | §30 | §31 | Δ |
|------|----:|----:|--:|
| avgScore | 62.6 | 63.1 | +0.8% |
| avgWave | 9.07 | 9.33 | +0.26 |
| won | 3 | 3 | 0 |

### 负面结论
**evolve 几乎不触发**。死亡墙不动：
- 升级阶段贪心耗尽 resources，二阶段池常常为空
- 9 波内大部分节点没机会升到 level=5（资源不够）
- 即便满级，evolve cost (NODE_CONFIGS[type].cost × 3) + crystals 是大额支出
- 当前 priority 顺序先升级低级节点 > 后 evolve，时机太晚

### 验证
- `npm run build` 168.10 KB OK
- `npm run bench:check` 9/9 OK（off 路径未变）
- AB sweep 54 runs 完成

### 下一步候选
- A. `§32` autoUpgrade 预算策略：保留 X% 资源/晶体给 evolve；或检测到任何节点满 5 级时优先 evolve
- B. `§32` 降低 `ECONOMY.evolutionCostMult` (3 → 2) 让 evolve 更易触发
- C. `§32` enemy wave 8+ HP 缩放下调（直接攻击死亡墙根因）
- D. `§32` 加 instrumentation 统计 evolve 实际触发次数 / level 分布
---

## §32 · nodeStats instrumentation 揭示 evolve 不触发的真因

### 目标
§31 假设 evolve 没用是因为时机晚，但缺数据。本节加 `nodeStats` 字段（evolvedByType + levelDist + countByType）打到 final BenchResult，bench-batch 聚合输出。

### 代码改动
**[src/benchmark.ts](src/benchmark.ts)**：
1. `BenchResult` 加可选 `nodeStats` 字段
2. 新增 `collectNodeStats(nodes)`：扫 final `s.nodes`，按 type/level/evolved 分组计数
3. final result 构造时调用

**[scripts/bench-batch.mjs](scripts/bench-batch.mjs)**：聚合阶段加 `nodeStats aggregate`，按 AB 分组打印每 run 平均 evolved 数 + L1-L5 节点数分布

### 关键数据（54 runs，3 seeds × 3 levels × 3 pools × AB）

\\\
[autoUpgrade=off] evolved: (none)
                  levelDist: L1=11.4 L2/3/4/5=0/0/0/0 (n=27)
[autoUpgrade=on ] evolved: energy=0.07
                  levelDist: L1=13.7 L2=0.1 L3=0.4 L4=0.0 L5=0.2 (n=27)
\\\

### 结论：autoUpgrade 雨露均沾导致 evolve 几乎不触发
- on 模式下平均每 run 仅 **0.2 个节点能升到 L5**，其余卡在 L1
- evolved 总计 ~0.07/run（27 runs 只有 ~2 次进化，全是 energy）
- 原因：§27 sort 是 `level ASC`，所有 L1 节点先升 L2 再升 L3，**预算被均分**；turret/shield 节点多，每个分到的资源不够升满
- energy 节点少（1-2 个），偶尔有运气升满 → evolve 出现的是 energy 不是 turret/shield

### 验证
- `npm run build` 168.38 KB OK
- `npm run bench:check` 9/9 OK（CSV 列未变，nodeStats 仅写入 JSON）
- AB sweep 54 runs 完成，instrumentation 输出按预期

### §32 不改游戏逻辑
本节纯诊断。不变更 balance.ts / benchmark.ts 业务行为。

### §33 候选（基于 §32 数据）
- A. `§33` autoUpgrade 改"养精兵"策略：同 type 只升当前最高级节点到 L5+evolve，再轮下一个
- B. `§33` 设阈值：检测到任何 turret/shield ≥ L4 时，停止升其它节点，集中冲顶
- C. `§33` 降低 `ECONOMY.upgradeBaseCost` (30 → 20) 让升级更廉价
- D. `§33` 降低 `ECONOMY.evolutionCostMult` (3 → 2) 直接放低 evolve 门槛
---

## §33 · autoUpgrade ""养精兵""策略（集中冲顶）

### 目标
§32 揭示雨露均沾导致 evolve 几乎不触发。本节重写 `tickAutoUpgrade`：同一候选列表内按 **level DESC** 排序（最高级优先冲顶），单节点 upgrade→evolve 一气呵成，再轮下一个。

### 代码改动
**[src/benchmark.ts](src/benchmark.ts)** `tickAutoUpgrade`：
1. 候选合并 upgradable + 已满未进化 EVOLVABLE 一个列表
2. sort 改：跨 type prio ASC（turret>shield>others）；同 type 内 `level DESC`；id 稳定 tiebreaker
3. 每节点循环：能 upgrade 到 L5 → 立即 evolve（如果 EVOLVABLE）→ 下一个
4. 删除 §31 的二阶段独立扫描

### 验证 sweep（54 runs，同 §32 配置）

\\\
[autoUpgrade=off] n=27 avgScore=34.1 avgWave=9.04 won=1
[autoUpgrade=on ] n=27 avgScore=78.5 avgWave=9.26 won=3
\\\

### 对比 §32 vs §33（autoUpgrade=on）
| 指标 | §32 | §33 | Δ |
|------|----:|----:|--:|
| avgScore | 64.6 | **78.5** | **+22%** |
| avgWave | 9.00 | 9.26 | +0.26 |
| won | 3 | 3 | 0 |
| evolved | energy=0.07 | energy=0.04 | **-43%** |
| L5 nodes/run | 0.2 | 0.3 | +50% |

### 部分胜利 · 部分负面
- **+22% score** 是 §28 以来最大单次提升；L5 节点数也涨了
- 但 **won 不变**（3/27），死亡墙稳如泰山
- **evolved 反而变少**：养精兵让 turret/shield 优先冲顶，但 turret 不在 EVOLVABLE 名单（手动 evolve 路径才能；需查 EVOLVABLE_TYPES）；energy 是 EVOLVABLE 但 prio 最低，资源轮不到
- 真正瓶颈：**资源池总量不够**。off 模式 L1 节点 13.4 个但全部 L1，on 模式只有 0.3 个能到 L5——预算约束硬上限

### 验证
- `npm run build` 168.33 KB OK
- `npm run bench:check` 9/9 OK
- AB sweep 54 runs，nodeStats 已按 AB 分组输出

### §34 候选（基于 §33 数据）
- A. `§34` 检查 `EVOLVABLE_TYPES` 实际成员（确认 turret/shield 是否在内），如不在需扩展
- B. `§34` 调高 `ECONOMY.mineOutputBase`（3→4 或 5）增加资源池总量，攻击死亡墙
- C. `§34` 调低 `ECONOMY.upgradeBaseCost`（30→20）让升级更便宜
- D. `§34` enemy wave 8+ HP 缩放下调，直接降低死亡墙高度
---

## §34 · EVOLVABLE_TYPES 名单与 evolve 成本诊断（零代码）

### 目标
§33 evolved 几乎只有 energy 出现（0.04/run），怀疑 turret/shield 不在 EVOLVABLE 名单。本节查证。

### 查证结果
**[src/data/evolution.ts](src/data/evolution.ts) `EVOLVABLE_TYPES`** 涵盖 19 种节点，包括 `turret/shield/energy/mine/tesla/factory/...`。**名单没问题**。

### evolve 成本对照表
\\\
calcEvolutionCost(type)        = NODE_CONFIGS[type].cost × 3
calcEvolutionCrystalCost(type) = ceil(cost / 16)
\\\

| 类型 | cost | evoCost(res) | evoCrystal |
|------|----:|----:|----:|
| turret | 50 | **150** | **4** |
| shield | 60 | **180** | **4** |
| energy | 30 | 90 | **2** |
| mine | 40 | 120 | **3** |

### Crystal 来源（[src/data/balance.ts](src/data/balance.ts) ENEMY_DEATH_REWARDS）
\\\
scout=1 swarm=1 splitter=1
heavy=2 stealth=2 disruptor=2 healer=2 shielder=2
boss=8
default=1
\\\

### 真因诊断
- ✗ EVOLVABLE 名单不是问题
- **✓ Crystal 是双瓶颈之一**：§33 养精兵优先 turret/shield（需 4 crystal），但 9 波击杀总 crystal ~10-20 → 升满 L5 时常 crystal 不够 → fallthrough 到 energy（仅需 2 crystal）→ energy 偶尔进化成功
- **✓ Resource 也是瓶颈**：升级 5 级累计 30+60+90+120 = 300 resources/节点；养精兵冲 turret 还要再凑 150 才能 evolve = **450 res/turret**
- 死亡墙根因：单次 sweep 总产出（mine ×9 wave × ~3 res/wave + 击杀 res）远不够多个节点冲顶

### §35 候选（基于双瓶颈分析）
- A. `§35` 调高 `mineOutputBase` 3→5（直接增 res 池），AB 验证 won 是否破墙
- B. `§35` 调低 `evolutionCrystalDivisor` 16→8（crystal 成本 ×0.5），让 evolve 触发率提升
- C. `§35` 调低 `evolutionCostMult` 3→2（res 成本 ×0.67）
- D. `§35` enemy reward.crystal +1（提升 crystal 产出而非降成本）
---

## §35 · mineOutputBase 3→5 验证（已回滚）

### 目标
§34 诊断 res+crystal 双瓶颈。本节攻击 res 侧：`mineOutputBase 3→5` 同时 `mineOutputOvercharge 6→8`（资源增产 ~67%）。

### 验证 sweep（54 runs，同 §33 配置）
\\\
[autoUpgrade=off] n=27 avgScore=38.3 avgWave=8.96 won=3
[autoUpgrade=on ] n=27 avgScore=63.0 avgWave=9.56 won=3
\\\

### 对比 §33 vs §35（autoUpgrade=on）
| 指标 | §33 | §35 | Δ |
|------|----:|----:|--:|
| avgScore | 78.5 | **63.0** | **-20%** |
| avgWave | 9.26 | 9.56 | +0.30 |
| won | 3 | 3 | 0 |
| evolved | energy=0.04 | energy=0.04 | 0 |
| L5 | 0.3 | 0.3 | 0 |
| L1 nodes | 13.0 | 10.6 | -18% |

### 负面结论 → 回滚
- score **-20%**，evolved 完全无改善 → **crystal 才是真瓶颈，纯加 res 无效**
- L1 节点降 18%（off 模式 L1 反升 13.4→16.7）→ 增产的 res 大部分被新建造或低 level 升级吸走
- avgWave +0.30 是唯一正面，但代价太大
- 已回滚 `mineOutputBase: 3, mineOutputOvercharge: 6`

### 验证
- 回滚后 `npm run build` OK
- `npm run bench:check` 9/9 OK（baseline pool 不含 mine）
- 教训：**调单一变量前应先确认它是约束变量**。§34 双瓶颈分析是对的，但优先级应是 crystal 而非 res

### §36 候选
- A. `§36` 调低 `evolutionCrystalDivisor 16→32`（crystal 成本 ×0.5）直接攻击 crystal 瓶颈
- B. `§36` 调高 `ENEMY_DEATH_REWARDS.*.crystal` 全 +1（crystal 产出侧）
- C. `§36` 调低 `evolutionCostMult 3→2`（res 侧 evolve 门槛 -33%）
- D. `§36` 不再调 balance，直接动 enemy wave 8+ HP 缩放

---

## §V1.0.4 · 模态焦点栈 + 主题面板鼠标交互

> 提交：V1.0.4 主题切换焦点栈与鼠标交互  
> 日期：2026-04-27

### 背景

V1.0.3 修复线上关卡卡死后，进入「8 项产品化体验优化」迭代。V1.0.4 聚焦第 3 项：**键盘只对最顶层窗口生效 + 主题切换支持鼠标**。

### 实现

- 新增 `src/focus-stack.ts`：window 级 capture-phase keydown 拦截，栈非空时 `stopImmediatePropagation` 阻断后续监听，事件仅交给栈顶 handler
- `src/main.ts` 在所有屏幕之前 `import './focus-stack'` 完成注册
- `src/theme-picker.ts` 改造：
  - 不再走原来的 isPickerOpen 全局态，而是 `pushModal(handler)` 注册键盘独占
  - 列表项 `addEventListener('mouseenter')` 同步高亮，`addEventListener('click')` 立即应用并关闭
  - 遮罩 click 关闭、Esc 关闭、Shift+T 二次关闭

### Web 验证（http://127.0.0.1:4173/Starfield_Nodes/）

| 验证项 | 结果 |
|------|----|
| Shift+T 打开主题面板 | ✅ 出现「选择主题」浮层与 6 个主题项 |
| Enter 应用并关闭 | ✅ |
| 鼠标点击 `[data-name=sakura]` 切换主题 | ✅ 面板自动关闭 |
| 焦点栈独占：面板打开时按 Delete | ✅ overlay 不被关闭，登录页删除档案逻辑未触发 |
| Esc 关闭 | ✅ |
| Console error | 0 |

### 后续 V1.0.x 待办（用户列出 8 项剩余）

1. ESC 暂停菜单（设置 / 返回标题 / 重开关卡） → 中版本 V1.1.0
2. 关卡失败重启直接进选卡页 + 杀旧进程
4. 项目规划改为以本体内容为主（去除反作弊等优化项优先级）
5. 节点选择按选择顺序绑定 1-5 键
6. 科技树鼠标交互 + 按键 10→0 + UI 布局优化

> 元规则：每改一项必走 build → preview → 浏览器 MCP 验证 → 文档同步；提交格式 `V{大}.{中}.{小}` 中文；中版本递增需分支合并管理。


---

## §V1.0.5 · 节点按选择顺序绑定数字键 1-N

> 提交：V1.0.5 节点选择顺序绑定数字键  
> 日期：2026-04-27

### 背景

V1.0.4 之前数字键 1-9, 0 是固定映射到 `energy/turret/mine/shield/...` 等节点类型，与当前关卡是否选中无关。如果玩家选了「炮塔/矿机/护盾/能量站」四张卡，按键 1 仍然是 energy（且能量站在键 4 上），认知成本高。

### 实现

- `src/node-select.ts`：`selected` 由 `Set<NodeType>` 改为 `NodeType[]`，按 push 顺序保留；卡片右下角和「出战编队」预览各加一个绑定数字角标
- `src/input.ts`：`buildMap` 优先按 `allowedNodeTypes` 顺序动态映射 `1..9, 0`；缺少 allowedNodeTypes 时（bench/调试）退回原 24 键静态表
- `src/ui.ts`：`drawBuildPanel` 同样优先按 `allowedNodeTypes` 顺序使用数字键并渲染

### Web 验证

| 验证项 | 结果 |
|------|----|
| 节点选择面板出战编队角标 1..N | ✅ |
| 改变选择顺序后角标随之改变 | ✅（取消能量站后重新选→变 [4]） |
| 游戏内构建面板按选择顺序显示 [1][2][3][4] | ✅ |
| Console error | 0 |


## §V1.0.6 · 科技树鼠标交互 + 第 10 个科技按键 0

> 提交：V1.0.6 科技树鼠标交互与按键 0 映射  
> 日期：2026-04-27

### 背景

V1.0.5 之前科技树面板仅支持数字键 1-9 研究，第 10 个科技无法用键盘触发；同时鼠标点击科技卡片不会研究，与玩家直觉相悖。提示文案「点击数字键研究」也容易被误解为"点击屏幕上的数字"。

### 实现

- `src/ui.ts`：`drawTechPanel` 在绘制科技卡片时把每张卡的屏幕矩形 + `available/unlocked/techId/idx` 推入 `UI.techCardAreas`；提示文案改为「鼠标点击 / 数字键研究 (1-9, 0)  ·  [Esc] 关闭」；快捷键标签 `[N]` 在 `keyIdx === 9` 时显示 `[0]`。
- `src/input.ts`：`onMouseDown` 在科技树打开时优先检查 `techCardAreas` 命中，命中可研究项则调用 `researchTech`，并直接 `return` 阻止事件穿透到画布（防止误选节点）；`onKeyDown` 中的科技树分支接受 `'0'` 映射到 `tree[9]`。

### Web 验证

| 验证项 | 结果 |
|------|----|
| 提示文案「鼠标点击 / 数字键研究 (1-9, 0)  ·  [Esc] 关闭」 | ✅ |
| 鼠标点击「高效链路」研究成功（资源 120 → 40） | ✅ |
| 已研究卡片显示「✓ 已研究」 | ✅ |
| Esc 关闭面板回到游戏画面 | ✅ |
| Console error | 0 |

### 备注

第 10 个科技在初始关卡因前置依赖未解锁，本次未直接观察到 `[0]` 标签渲染；代码逻辑等价于既有的 1-9 分支，下一关解锁高级列后将自然可见。

## §V1.1.0 · 暂停菜单 + 失败重开直进选卡

> 提交：V1.1.0 暂停菜单与失败重开流程  
> 日期：2026-04-27

### 背景

8 项产品化优化的第 1、2 项：
- **item 1**：游戏中缺少正式的暂停菜单，玩家无法在不退出页面的情况下回到选卡或选档案
- **item 2**：关卡失败后按 R 是「原地重开当前关卡」，但用户期望失败时直接回选卡页面，避免被强制再过一次过场

### 实现

- `src/ui.ts`：UI 类新增 `pauseMenuOpen / pauseMenuIndex / pauseMenuItems / pauseMenuAreas`；新增 `drawPauseMenu(state)`，含半透明遮罩、4 项卡片、高亮态、数字角标 `[1]-[4]`、底部操作提示。`drawPaused` 在菜单打开时不渲染，避免重叠。
- `src/input.ts`：
  - InputManager 构造函数新增可选 `onExitToLevelSelect / onExitToTitle` 回调
  - `onKeyDown` 在菜单打开时通过 `handlePauseMenuKey` 独占输入：↑↓/WS 切换、1-9 直选、Enter/Space 触发、Esc 关闭
  - `onMouseDown` 在菜单打开时优先命中 `pauseMenuAreas`，命中即触发对应动作；未命中也不透传到画布
  - 失败状态按 R：从 `this.onRestart()` 改为 `this.onExitToLevelSelect()`（无回调时退回 `onRestart`）
  - 普通 ESC：先吃掉「连线/建造/选中」上下文，没有上下文且非 gameOver/levelWon/教程时打开暂停菜单
- `src/game.ts`：Game 构造函数新增 `onExitToLevelSelect / onExitToTitle` 参数并透传给 InputManager
- `src/main.ts`：`startGame` 提取 `exitToLevelSelect`（复用关卡结束流程）和 `exitToTitle`（清理后 `new LoginScreen`），分别注入给 Game

### Web 验证

| 验证项 | 结果 |
|------|----|
| 游戏内按 Esc 弹出暂停菜单（半透明遮罩 + 4 项） | ✅ |
| ↑↓ 切换高亮 | ✅ |
| Enter 触发「返回选卡」直接回选卡页 | ✅ |
| 数字键 [2] 重开本关，WAVE/资源重置 | ✅ |
| 鼠标点击「返回标题」回登录页（游戏次数 +1，stop 时已保存） | ✅ |
| Console error | 0 |

### 备注

- Item 2「失败重开直进选卡」走 `onExitToLevelSelect`，与暂停菜单的「返回选卡」共享同一回调路径。
- 中版本递增按全局规则使用 `feature/v1.1` 分支开发，验证通过后合并回 main。
## §V1.1.2 节点机制纵深首批：buffer ↔ collector 经济共振（2026-04-27 增补 · Phase β-1）

### 背景

V1.1.1 重排路线图后，Phase β「玩法体验深化」首要任务是给现有节点池增加**机制性联动**，让玩家从"单点 spam"走向"组合布置"。本次选取 buffer × collector 作为首对联动：

- buffer：给邻居充能（无方向性）
- collector：附近敌人越多产出越高（独立产能）
- 二者原本各打各的，但都属于「经济流派」核心节点 → 天然适合做共振

### 实现

#### 数据层 src/data/balance.ts

COMBAT.collector 新增两个字段：

- synergyBufferBonus: 0.25 —— 直连任意 player owned buffer 时，单 tick 资源产出 ×1.25（多个 buffer 不叠加，避免刷分）
- synergyCrystalThresholdReduce: 1 —— 进化形态下，每接 1 个 buffer，晶体阈值 crystalThreshold 减 1（最低 1）。鼓励"多 buffer 包围 + 进化 collector"流派

#### 逻辑层 src/graph.ts collectorHarvest

- 遍历 state.edges，统计直连 collector 的 player owned 且未销毁的 buffer 数 ufferLinkCount
- synergyMult = bufferLinkCount > 0 ? 1.25 : 1，应用到 output
- 进化形态下，有效阈值 max(1, crystalThreshold - bufferLinkCount × 1)

#### 渲染层 src/renderer.ts drawEdges

- 当一条活跃边的两端是同 owner（非中立）的 buffer + collector 时，叠加金色脉冲描边（rgba(255,215,96, 0.30~0.60) 正弦呼吸）
- 玩家可一眼看出"哪条线在生效"

### 设计取舍

- **不叠加产能**：避免一个 collector 接 N 个 buffer 把经济推爆
- **晶体阈值减免可叠加**：晶体本身产量低（每 tick 至多 1），叠加后峰值可控，且鼓励玩家做"多 buffer 网络"
- **范围式 vs 连线式**：故意采用「edge 直连」而非「距离判定」，因为后者会让玩家被动获益、缺乏决策；前者要求玩家主动布置，符合「机制纵深」的目标

### 验证

| 项目 | 结果 |
|---|---|
| TypeScript 类型检查 | ✅ 0 错误 |
| 
pm run build | ✅ 109ms，bundle 173.64 KB（+约 0.4 KB） |
| 
pm run preview 启动 | ✅ http://localhost:4173/Starfield_Nodes/ |
| 联动判定逻辑 | ✅ 同 owner + type 配对 + edge 端点 4 行确定性代码 |
| 游戏内手动实测 | ⏳ buffer + collector 在第 3 关「迷雾深处」起才解锁，留作下个 V 版本随其他改动一起验证 |

### 后续

- Phase β 下一对候选：**portal × interceptor**（"出门一炮"陷阱组合）
- 待玩家自然解锁第 3 关后，回归一次 buffer-collector 视觉效果与平衡表现
- 若 +25% 产能在 bench 中导致 winrate > 90%，回调到 +15%


## §V1.1.2 节点机制纵深首批：buffer ↔ collector 经济共振（2026-04-27 增补 · Phase β-1）

### 背景

V1.1.1 重排路线图后，Phase β「玩法体验深化」首要任务是给现有节点池增加**机制性联动**，让玩家从"单点 spam"走向"组合布置"。本次选取 buffer × collector 作为首对联动：

- buffer：给邻居充能（无方向性）
- collector：附近敌人越多产出越高（独立产能）
- 二者原本各打各的，但都属于「经济流派」核心节点 → 天然适合做共振

### 实现

#### 数据层 src/data/balance.ts

`COMBAT.collector` 新增两个字段：

- `synergyBufferBonus: 0.25` —— 直连任意 player owned buffer 时，单 tick 资源产出 ×1.25（多个 buffer 不叠加，避免刷分）
- `synergyCrystalThresholdReduce: 1` —— 进化形态下，每接 1 个 buffer，晶体阈值 `crystalThreshold` 减 1（最低 1）。鼓励"多 buffer 包围 + 进化 collector"流派

#### 逻辑层 src/graph.ts collectorHarvest

- 遍历 `state.edges`，统计直连 collector 的 player owned 且未销毁的 buffer 数 `bufferLinkCount`
- `synergyMult = bufferLinkCount > 0 ? 1.25 : 1`，应用到 output
- 进化形态下，有效阈值 `max(1, crystalThreshold - bufferLinkCount * 1)`

#### 渲染层 src/renderer.ts drawEdges

- 当一条活跃边的两端是同 owner（非中立）的 buffer + collector 时，叠加金色脉冲描边（rgba(255,215,96, 0.30~0.60) 正弦呼吸）
- 玩家可一眼看出"哪条线在生效"

### 设计取舍

- **不叠加产能**：避免一个 collector 接 N 个 buffer 把经济推爆
- **晶体阈值减免可叠加**：晶体本身产量低（每 tick 至多 1），叠加后峰值可控，且鼓励玩家做"多 buffer 网络"
- **范围式 vs 连线式**：故意采用「edge 直连」而非「距离判定」，因为后者会让玩家被动获益、缺乏决策；前者要求玩家主动布置，符合「机制纵深」的目标

### 验证

| 项目 | 结果 |
|---|---|
| TypeScript 类型检查 | OK 0 错误 |
| `npm run build` | OK 109ms，bundle 173.64 KB（+约 0.4 KB） |
| `npm run preview` 启动 | OK http://localhost:4173/Starfield_Nodes/ |
| 联动判定逻辑 | OK 同 owner + type 配对 + edge 端点 4 行确定性代码 |
| 游戏内手动实测 | TODO buffer + collector 在第 3 关「迷雾深处」起才解锁，留作下个 V 版本随其他改动一起验证 |

### 后续

- Phase β 下一对候选：**portal × interceptor**（"出门一炮"陷阱组合）
- 待玩家自然解锁第 3 关后，回归一次 buffer-collector 视觉效果与平衡表现
- 若 +25% 产能在 bench 中导致 winrate > 90%，回调到 +15%
