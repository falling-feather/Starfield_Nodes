# 星域节点 (Starfield Nodes) 开发文档

> **版本**: 0.1.0  
> **技术栈**: TypeScript + Vite + Canvas 2D  
> **仓库**: https://github.com/falling-feather/Starfield_Nodes  
> **在线试玩**: https://falling-feather.github.io/Starfield_Nodes/

---

## 目录

1. [项目概述](#1-项目概述)
2. [项目结构](#2-项目结构)
3. [快速开始](#3-快速开始)
4. [架构设计](#4-架构设计)
5. [核心系统详解](#5-核心系统详解)
6. [游戏玩法与操作](#6-游戏玩法与操作)
7. [关卡系统](#7-关卡系统)
8. [实体系统](#8-实体系统)
9. [UI 系统](#9-ui-系统)
10. [音频系统](#10-音频系统)
11. [存档系统](#11-存档系统)
12. [部署与构建](#12-部署与构建)
13. [开发规范](#13-开发规范)

---

## 1. 项目概述

**星域节点**是一款基于 Canvas 2D 渲染的即时战略塔防游戏。玩家在星域地图上建造节点、连接能量网络、研究科技，抵御来袭敌人波次，保护核心不被摧毁。

### 核心玩法循环

```
建造节点 → 连线建立能量网络 → 能量流动激活节点 → 节点自动攻防 → 抵御敌人波次 → 获取资源 → 扩展网络
```

### 游戏特色

- **11 种功能节点** — 每种有独立能力和升级/进化路线
- **4 种连线类型** — 不同吞吐量和增益效果
- **7 种敌人类型** — 各自有独特AI行为和目标优先级
- **8 个关卡** — 解锁式推进，含Boss战和限时挑战
- **科技树 / 成就 / 存档** — 完整的 Meta 系统

---

## 2. 项目结构

```
Starfield_Nodes/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages 自动部署工作流
├── dist/                       # 构建产物（自动生成）
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/                 # 静态资源（图片）
│   ├── achievements.ts         # 成就系统
│   ├── audio.ts                # Web Audio 音效
│   ├── counter.ts              # Demo 计数器（未使用）
│   ├── cutscene.ts             # 过场动画
│   ├── entities.ts             # 敌人/节点实体逻辑
│   ├── fog.ts                  # 战争迷雾
│   ├── game.ts                 # ★ 游戏主循环
│   ├── graph.ts                # ★ 图论算法/能量分配
│   ├── input.ts                # ★ 输入交互系统
│   ├── keybinds.ts             # 快捷键映射
│   ├── level-select.ts         # 选关界面
│   ├── levels.ts               # 关卡配置表
│   ├── login.ts                # 登录/档案界面
│   ├── main.ts                 # ★ 入口点 / 流程编排
│   ├── node-select.ts          # 选卡界面（PvZ风格）
│   ├── particles.ts            # 粒子系统
│   ├── renderer.ts             # ★ 世界渲染器
│   ├── save.ts                 # 存档管理
│   ├── style.css               # 全局样式
│   ├── tech.ts                 # 科技树
│   ├── tutorial.ts             # 新手教程
│   ├── types.ts                # ★ 核心类型定义
│   └── ui.ts                   # ★ HUD/菜单渲染
├── index.html                  # HTML 入口
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 文件职责矩阵

| 文件 | 职责 | 依赖 | 被依赖 |
|------|------|------|--------|
| **main.ts** | 流程编排：登录→选关→选卡→过场→游戏 | 几乎所有模块 | index.html |
| **game.ts** | 游戏主循环：帧更新、Tick积累、物理/渲染调度 | types, entities, graph, renderer, input, ui, audio | main |
| **types.ts** | 所有接口、枚举、常量定义 | 无 | 所有模块 |
| **input.ts** | 鼠标/键盘输入处理、建造/选择/框选/平移 | types, graph, audio, ui, keybinds, tutorial | game |
| **ui.ts** | HUD/菜单/科技树/成就面板/教程框等所有 UI 绘制 | types, achievements, keybinds, audio, tutorial | game, input |
| **renderer.ts** | 世界空间渲染：星空、节点、边、敌人、粒子、特效 | types, fog | game |
| **graph.ts** | 图结构算法：能量流动、连通性、地形效果 | types | game, input |
| **entities.ts** | 敌人生成/更新/AI、节点创建、飞弹碰撞 | types, particles | game |
| **particles.ts** | 粒子生成/更新/衰减 | types | entities, renderer |
| **audio.ts** | Web Audio API 程序化音效 | 无 | input, ui, game |
| **levels.ts** | 6个关卡的配置数据 | types | main, game, level-select |
| **save.ts** | localStorage 存档读写 | 无 | main, login |
| **tech.ts** | 9 个科技节点的定义和研究逻辑 | types | game, input, ui |
| **achievements.ts** | 15 个成就的定义和检测逻辑 | types | game, ui |
| **fog.ts** | 战争迷雾 OffscreenCanvas 系统 | types | renderer |
| **tutorial.ts** | 分步教程状态机 | types | input, ui |
| **keybinds.ts** | 快捷键映射和自定义 | 无 | input, ui |
| **login.ts** | 登录/档案管理 UI | save | main |
| **level-select.ts** | 关卡选择菜单 | levels | main |
| **node-select.ts** | PvZ 风格选卡界面 | types, levels | main |
| **cutscene.ts** | 过场动画文本渲染 | 无 | main |

---

## 3. 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 安装与运行

```bash
git clone https://github.com/falling-feather/Starfield_Nodes.git
cd Starfield_Nodes
npm install
npm run dev        # 启动开发服务器（HMR）
```

### 构建

```bash
npm run build      # 产物输出到 dist/
npm run preview    # 预览构建产物
```

### 开发配置

| 配置 | 说明 |
|------|------|
| TypeScript | ES2023 目标，bundler 模块解析，严格未使用变量检查 |
| Vite | base: `/Starfield_Nodes/`（GitHub Pages 路径） |
| DPR | 自动适配 `window.devicePixelRatio`（通常为 1.5） |

---

## 4. 架构设计

### 4.1 游戏流程

```
┌─────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────┐   ┌──────────┐
│ LoginScreen│→│LevelSelectScreen│→│NodeSelectScreen│→│CutsceneScreen│→│  Game    │
│  (登录)   │   │  (选关)       │   │  (选卡)      │   │  (过场)   │   │ (游戏)   │
└─────────┘   └──────────────┘   └─────────────┘   └──────────┘   └──────────┘
                                                                        │
                                                          胜利/失败 → 返回选关
```

### 4.2 游戏主循环

```typescript
// game.ts - requestAnimationFrame 驱动
loop(timestamp):
  1. 计算 deltaTime
  2. 累积器 += deltaTime × timeScale
  3. while (累积器 >= TICK_INTERVAL):   // 500ms 固定步长
       - tick()                          // 逻辑更新
       - 累积器 -= TICK_INTERVAL
  4. render(deltaTime)                   // 每帧渲染
```

### 4.3 数据流

```
GameState (单一状态对象)
    ↕ 读写
  ┌─────┬─────────┬───────────┬─────────┐
  │Game │InputMgr │Renderer   │UI       │
  │(逻辑)│(输入)   │(世界渲染) │(HUD渲染)│
  └─────┴─────────┴───────────┴─────────┘
```

所有系统共享同一个 `GameState` 对象。`Game` 在 tick 中更新逻辑状态，`InputManager` 处理用户输入修改状态，`Renderer` 和 `UI` 每帧读取状态进行渲染。

### 4.4 坐标系统

- **世界坐标**: 游戏逻辑空间，节点/敌人位置使用世界坐标
- **屏幕坐标**: 像素空间，鼠标事件使用屏幕坐标
- **转换**: `screenToWorld(sx, sy)` 考虑 camera offset + zoom

```typescript
世界X = 屏幕X / zoom + camera.x
世界Y = 屏幕Y / zoom + camera.y
```

---

## 5. 核心系统详解

### 5.1 Tick 系统

- **TICK_INTERVAL**: 500ms（每秒 2 tick）
- **帧积累器**: 确保逻辑更新与渲染解耦
- **timeScale**: 1x / 2x / 3x 加速

每个 tick 依次执行：
1. 能量分配（graph.ts `distributeEnergy`）
2. 节点更新（hp再生、能量消耗、攻击CD）
3. 敌人更新（移动、攻击、分裂、隐匿）
4. 飞弹更新（碰撞检测）
5. 粒子更新
6. 超载检测
7. **敌人生成**（20秒空窗期后开始）
8. Boss 生成检测
9. 波次递增（每30 tick）
10. 胜利/失败条件检测

### 5.2 能量系统 (graph.ts)

```
核心(core) → 产生能量(15/tick)
           → 通过边(edge)传输到相连节点
           → 节点吃够能量(activationThreshold)后激活
           → 激活的节点执行各自功能
```

**能量分配策略**:
- BFS 从核心向外传播
- 每条边有吞吐量上限（由 EdgeType 决定）
- amplify 类型边传输+30%增益
- 地形星云(nebula)减速能量流动

**超载机制**:
- 节点连续接收超过容量的能量时进入超载
- 超载状态：攻击力 ×1.5，但持续掉血
- 超载结束后有冷却期

### 5.3 连通性检测

```typescript
updateConnectivity(state):
  BFS从core出发 → 可达的节点 connected = true
  不可达的节点 connected = false → 功能失效
```

### 5.4 输入系统 (input.ts)

#### 鼠标交互流程

```
左键按下(mouseDown):
  ├─ Ctrl 按住 → 开始摄像机平移
  ├─ 点击 UI 按钮 → 执行按钮功能
  ├─ 建造模式中 → 放置节点
  ├─ 连线模式中 + 点击目标节点 → 完成连线
  ├─ 点击节点 → 记录 nodeClickOrigin（等待mouseUp判断）
  └─ 点击空白
      ├─ Shift 按住 → 开始框选
      └─ 普通 → 取消所有选择

鼠标移动(mouseMove):
  ├─ 平移中 → 更新摄像机位置
  ├─ nodeClickOrigin存在 + 超过10px阈值 → 进入拖拽连线模式
  └─ 框选中 → 更新框选矩形

左键抬起(mouseUp):
  ├─ 拖拽连线中 → 尝试连接目标节点
  ├─ 节点点击（未拖拽）→ 弹出弧形菜单
  └─ 框选结束 → 选中矩形内节点
```

#### 键盘快捷键

| 按键 | 功能 | 可自定义 |
|------|------|---------|
| 1-9, 0, - | 选择建造节点类型 | ✗ |
| U | 升级选中节点 | ✓ |
| X | 出售选中节点 | ✓ |
| P | 暂停/继续 | ✓ |
| T | 打开/关闭科技树 | ✓ |
| A | 打开/关闭成就面板 | ✓ |
| K | 打开/关闭快捷键设置 | ✗ |
| G | 切换时间加速 (1/2/3×) | ✓ |
| M | 静音/取消静音 | ✓ |
| Tab | 切换连线类型 | ✗ |
| Escape | 取消建造模式 / 跳过教程 | ✗ |
| R | 重新开始（失败后） | ✓ |

---

## 6. 游戏玩法与操作

### 6.1 基本操作

| 操作 | 方式 |
|------|------|
| **平移视角** | Ctrl + 左键拖拽 |
| **缩放视角** | 鼠标滚轮 |
| **选中节点** | 左键点击节点（弹出弧形菜单） |
| **拖拽连线** | 左键从节点A拖拽到节点B |
| **菜单连线** | 点击节点 → 弧形菜单"连线"按钮 → 点击目标节点 |
| **建造节点** | 按数字键选择类型 → 点击空地放置 |
| **框选节点** | Shift + 左键拖拽矩形（排除核心） |
| **取消选择** | 点击空白区域 |

### 6.2 弧形菜单

点击节点后弹出环形菜单，包含：
- **升级** (U) — 消耗资源提升节点等级
- **出售** (X) — 回收节点获得资源
- **招募** — 将中立节点收编（仅中立节点）
- **扩展** — 扩大核心领地半径（仅核心）
- **连线** — 进入连线模式，点击目标节点自动连接
- **进化** — 5级满级后可进化为高级形态（消耗晶体）

### 6.3 战斗流程

1. **开局空窗期** (20秒) — 无敌人，建立初始防御网络
2. **第一波** — 基础敌人(scout)开始刷新
3. **波次递增** — 每15秒提升波次，敌人类型逐步解锁
4. **Boss 关** — 特定波次触发 Boss 生成
5. **胜利条件** — 根据关卡类型: 存活指定波次 / 击杀Boss / 限时坚守

### 6.4 资源体系

| 资源 | 获取方式 | 用途 |
|------|---------|------|
| **能量 ◆** | 核心产出、矿机产出、击杀敌人掉落 | 建造节点、连线、升级、科技研究 |
| **晶体 ✧** | 特定关卡初始获得 | 高级连线(amplify)、节点进化 |

---

## 7. 关卡系统

### 7.1 关卡配置 (levels.ts)

| ID | 名称 | 目标类型 | 目标波次 | Boss | 限时 | 初始资源 | 初始晶体 | 最大节点 | 难度倍率 | 前置关卡 |
|----|------|---------|---------|------|------|---------|---------|---------|---------|---------|
| 1 | 初始星域 | survive | 10 | ✗ | ∞ | 120 | 0 | 25 | 0.8× | — |
| 2 | 边境前哨 | survive | 15 | ✗ | ∞ | 100 | 2 | 35 | 1.0× | 关卡1 |
| 3 | 迷雾深处 | boss | 20 | ✓ W15 | ∞ | 150 | 3 | 40 | 1.2× | 关卡2 |
| 4 | 闪电突袭 | timed | — | ✗ | 180s | 200 | 3 | 20 | 1.5× | 关卡2 |
| 5 | 多核心战役 | survive | 20 | ✗ | ∞ | 180 | 4 | 50 | 1.3× | 关卡3 |
| 6 | 虫巢终焉 | boss | 25 | ✓ W20 | ∞ | 200 | 5 | 45 | 1.8× | 关卡5 |
| 7 | 裂隙风暴 | survive | 30 | ✗ | ∞ | 230 | 6 | 60 | 2.0× | 关卡6 |
| 8 | 终局奇点 | boss | 35 | ✓ W28 | ∞ | 260 | 8 | 70 | 2.3× | 关卡7 |

### 7.2 解锁机制

```
关卡1 (无前置) → 通关解锁 关卡2
关卡2 → 通关解锁 关卡3 和 关卡4
关卡3 → 通关解锁 关卡5
关卡5 → 通关解锁 关卡6
关卡6 → 通关解锁 关卡7
关卡7 → 通关解锁 关卡8
```

**GM 模式**: 用户名为 `falling-feather` 时解锁全部关卡。

### 7.3 可用节点逐关解锁

| 关卡 | 新增可用节点 |
|------|-------------|
| 1 | energy, turret, mine, shield, relay |
| 2 | + tesla |
| 3 | + beacon |
| 4 | + trap, magnet |
| 5 | + factory, core |
| 6 | 全部 11 种 |

---

## 8. 实体系统

### 8.1 节点类型 (types.ts NODE_CONFIGS)

| 类型 | 中文名 | 成本 | HP | 能量容量 | 激活阈值 | 半径 | 特殊能力 |
|------|--------|-----|-----|---------|---------|------|---------|
| core | 核心 | 200 | 500 | 200 | 0 | 28 | 产生能量(15/tick)，可扩展领地 |
| energy | 能量站 | 30 | 120 | 80 | 20 | 16 | 中继并放大能量传输 |
| turret | 炮塔 | 50 | 150 | 60 | 30 | 18 | 自动攻击敌人(射程150) |
| mine | 矿机 | 40 | 100 | 50 | 15 | 14 | 产出资源 |
| shield | 护盾 | 60 | 200 | 100 | 40 | 20 | 减免附近节点受到的伤害 |
| relay | 中继器 | 20 | 75 | 40 | 10 | 12 | 低成本能量转发节点 |
| tesla | 连锁塔 | 65 | 110 | 70 | 0 | 17 | 对经过的敌人施加电网AoE伤害 |
| beacon | 信标 | 35 | 75 | 50 | 15 | 14 | 揭示大范围战争迷雾 |
| factory | 工厂 | 80 | 150 | 80 | 35 | 19 | 周期性生成防御无人机 |
| magnet | 磁力塔 | 45 | 120 | 60 | 20 | 16 | 减速附近敌人移动速度 |
| trap | 陷阱 | 55 | 50 | 40 | 25 | 13 | 敌人路过时一次性范围爆炸 |

### 8.2 节点升级与进化

- **升级**: 1-5级，每级消耗 `baseCost × level` 资源
- **进化**: 达到5级后可进化（消耗 `baseCost × 3` 资源 + 晶体）

| 可进化类型 | 进化名称 |
|-----------|---------|
| turret | 狙击炮 |
| mine | 精炼厂 |
| shield | 堡垒 |
| energy | 核聚变 |
| tesla | 雷暴 |
| factory | 航母 |
| magnet | 黑洞 |

### 8.3 连线类型 (EdgeType)

| 类型 | 中文名 | 吞吐量 | 资源成本 | 晶体成本 | 效果 |
|------|--------|--------|---------|---------|------|
| standard | 标准链路 | 8 | 5 | 0 | 基础能量传输 |
| fast | 快速链路 | 14 | 12 | 0 | 高吞吐量传输 |
| heavy | 重型链路 | 20 | 15 | 0 | 超大带宽传输 |
| amplify | 增幅链路 | 8 | 20 | 3 | 传输能量 +30% |

**连线约束**:
- 最大长度: 200 单位
- 必须在核心领地范围内（400/600 半径）
- 不可重复连接同一对节点

### 8.4 敌人类型

| 类型 | 中文名 | 基础HP | 速度 | 伤害 | 出现波次 | AI 行为 |
|------|--------|--------|------|------|---------|---------|
| scout | 侦察兵 | 40 | 1.5 | 10 | 1+ | 追踪最近目标 |
| heavy | 重型 | 120 | 0.7 | 25 | 1+ | 直扑核心 |
| swarm | 蜂群 | 25 | 2.2 | 5 | 1+ | 追踪最近目标 |
| stealth | 隐匿者 | 35 | 1.8 | 15 | 8+ | 偷袭核心/能量站 |
| splitter | 分裂者 | 60 | 1.0 | 12 | 12+ | 死亡分裂为2-3个小体 |
| disruptor | 干扰者 | 50 | 1.4 | 8 | 12+ | 切断经过的连线 |
| boss | Boss | 500+ | 0.8 | 60+ | 关卡触发 | 优先攻击核心/炮塔 |

**目标优先级权重**:
```
scout   → 距离最近
heavy   → core(0.3)  直扑核心
swarm   → 距离最近
stealth → core(0.4), energy(0.7)
splitter→ core(0.5)
disruptor→ relay(0.3), core(0.9)  优先切断网络
boss    → core(0.35), turret(0.7)
```

### 8.5 敌人生成规则

- **空窗期**: 开局 20 秒（40 tick）无敌人
- **生成间隔**: `max(3, 8 - floor(wave/2))` tick
- **每次数量**: `1 + floor(wave/3)` 个
- **生成位置**: 距离存活节点 500-800 单位外随机
- **难度缩放**: 各属性乘以关卡 `difficultyMult`

---

## 9. UI 系统

### 9.1 UI 层级结构 (ui.ts)

```
┌─ HUD 顶栏 (50px) ─────────────────────────────────┐
│ WAVE | ★分数 | ◆资源 | ✧晶体 | ⚠敌人 | [T]科技 | ▶加速 | TICK │
├────────────────────────────────────────────────────┤
│                                                    │
│              游戏世界 (renderer.ts)                 │
│                                                    │
│     ┌─弧形菜单──┐   ┌──成就Toast──┐               │
│     │ 升级/出售  │   │ 🏆已解锁    │               │
│     │ 连线/进化  │   └────────────┘               │
│     └──────────┘                                  │
│                                                    │
│  ┌──批量操作面板──┐                                │
│  │全部升级/出售   │                                │
│  └───────────────┘                                │
├──── 底部建造栏 (64px) ─────────────────────────────┤
│ [1]能量站 [2]炮塔 [3]矿机 ... | 操作提示 | [Tab]连线│
└────────────────────────────────────────────────────┘
```

### 9.2 渲染层 (renderer.ts)

渲染顺序（从底到顶）:
1. **星空背景** — 静态星点 + 闪烁效果
2. **地形区域** — 星云/小行星/虫洞
3. **天气云层** — 动态星云飘移
4. **核心领地圈** — 半透明领地指示
5. **连线(Edge)** — 带能量流动粒子
6. **节点(Node)** — 带光晕、HP条、状态指示
7. **敌人(Enemy)** — 带类型图标和HP条
8. **飞弹(Projectile)** — 炮塔射击弹
9. **粒子(Particle)** — 爆炸/命中/死亡特效
10. **战争迷雾** — OffscreenCanvas 遮罩
11. **UI 层** — HUD、菜单、面板

### 9.3 弧形菜单 (Radial Menu)

选中节点后在节点周围环形布局操作按钮：
- 动态计算按钮位置（基于操作数量均匀分布在圆周上）
- 节点信息卡片显示在菜单上方/下方
- 按钮点击区域为圆形命中区

---

## 10. 音频系统

### 10.1 实现方式

使用 Web Audio API 程序化生成所有音效，无外部音频文件：

```typescript
AudioContext → OscillatorNode → GainNode → destination
```

### 10.2 音效列表

| 音效 | 触发时机 |
|------|---------|
| sfxBuild | 放置新节点 |
| sfxSell | 出售节点 |
| sfxConnect | 完成连线 |
| sfxAchievement | 解锁成就 |

### 10.3 注意事项

- AudioContext 需要用户交互后才能初始化（浏览器限制）
- 首次按键/点击时调用 `initAudio()`
- M 键切换静音

---

## 11. 存档系统

### 11.1 存储结构 (save.ts)

```typescript
interface SaveProfile {
  name: string;                    // 用户名
  createdAt: number;               // 创建时间戳
  lastPlayed: number;              // 最后游玩时间戳
  stats: {
    highScore: number;
    highWave: number;
    totalGamesPlayed: number;
    totalEnemiesKilled: number;
    totalNodesBuilt: number;
  };
  unlockedTechs: string[];         // 已解锁科技ID（跨关持久）
  currentLevel: number;
  clearedLevels: number[];         // 已通关的关卡ID列表
  unlockedAchievements: string[];  // 已解锁的成就ID列表
}
```

### 11.2 存储方式

- 使用 `localStorage` 读写
- Key: `starfield_profiles`
- 支持多档案（不同用户名）
- 自动兼容老存档字段缺失（main.ts `patchProfile`）

### 11.3 成就系统 (achievements.ts)

15 个成就分为：
- **通关类**: 初次胜利、全境征服、完美防线(0损失)
- **击杀类**: 百敌斩(100)、千敌灭(1000)、持久战(W20)
- **建造类**: 建筑大师(50)、电网专家(5 tesla)、多核架构(3+ core)
- **分数类**: 星域之星(5000分)、传奇指挥官(20000分)

### 11.4 科技树 (tech.ts)

| 层级 | 科技名 | 成本 | 效果 | 前置 |
|------|--------|------|------|------|
| Tier1 | 高效链路 | 150 | 边吞吐+4 | 无 |
| Tier1 | 强化结构 | 200 | 全节点HP+30% | 无 |
| Tier1 | 核心超频 | 180 | 核心产能+10/tick | 无 |
| Tier2 | 等离子炮塔 | 300 | 炮塔伤害×1.5 | 高效链路 |
| Tier2 | 量子中继 | 250 | 连线距离+80 | 高效链路 |
| Tier2 | 能量矩阵 | 280 | 节点能量上限×1.4 | 核心超频 |
| Tier2 | 纳米修复 | 350 | 节点HP自动恢复 | 强化结构 |
| Tier3 | 经济繁荣 | 500 | 建造成本×0.7 | 等离子+能量矩阵 |
| Tier3 | 狙击协议 | 450 | 炮塔射程×1.6 | 等离子+量子中继 |

---

## 12. 部署与构建

### 12.1 GitHub Pages 自动部署

```yaml
# .github/workflows/deploy.yml
触发: main 分支 push
流程: checkout → npm ci → npm run build → 推送 dist/ 到 gh-pages 分支
```

GitHub 自动从 `gh-pages` 分支部署到 Pages。

### 12.2 手动部署

```bash
npm run build
# 将 dist/ 目录部署到任意静态文件服务器
```

### 12.3 注意事项

- 构建时 `base` 路径为 `/Starfield_Nodes/`（GitHub Pages 子路径）
- 如部署到根路径，需修改 `vite.config.ts` 中的 base 为 `/`
- 游戏为纯前端 Canvas 应用，无后端依赖

---

## 13. 开发规范

### 13.1 代码风格

- TypeScript 严格模式
- 使用 `type` 关键字导入类型（`verbatimModuleSyntax`）
- 中文注释标注逻辑段落
- 常量使用 UPPER_SNAKE_CASE
- 接口使用 PascalCase

### 13.2 新增节点类型

1. 在 `types.ts` 的 `NodeType` 联合类型中添加新类型名
2. 在 `NODE_CONFIGS` 中添加配置（成本、HP、能量、半径等）
3. 在 `renderer.ts` 中添加渲染逻辑（图标、颜色）
4. 在 `entities.ts` 中添加特殊能力逻辑（如果有）
5. 在 `levels.ts` 中将新类型加入关卡可用列表

### 13.3 新增敌人类型

1. 在 `types.ts` 的 `EnemyType` 联合类型中添加
2. 在 `ENEMY_CONFIGS` 中添加配置
3. 在 `entities.ts` 的 `updateEnemies` 中添加 AI 行为
4. 在 `entities.ts` 的 `createEnemy` 中设置目标权重
5. 在 `renderer.ts` 中添加渲染图标

### 13.4 新增关卡

1. 在 `levels.ts` 的 `LEVELS` 数组中添加新的 `LevelConfig`
2. 在 `cutscene.ts` 中添加对应的过场文本
3. 设置 `unlockRequires` 指向前置关卡 ID

### 13.5 地形系统

| 地形类型 | 效果 |
|---------|------|
| nebula (星云) | 减速效果 (0-1 倍率)，影响敌人/粒子移动 |
| asteroid (小行星) | 静态障碍，不可通过 |
| wormhole (虫洞) | 成对传送，敌人和飞弹可被传送（2秒冷却） |
