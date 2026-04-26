# 🌌 星域节点 (Starfield Nodes)

> 在浩瀚星空中构建能量网络，防御来袭敌人 — 一款融合**图论网络管理**与**塔防策略**的即时战略 Web 游戏。

[![Play Now](https://img.shields.io/badge/🎮_在线试玩-点击进入-00ffff?style=for-the-badge)](https://falling-feather.github.io/Starfield_Nodes/)
[![Build](https://img.shields.io/badge/体积-gzip_~34KB-brightgreen?style=flat-square)]()
[![Tech](https://img.shields.io/badge/TypeScript-Canvas_2D-blue?style=flat-square)]()

---

## ✨ 特色

| 特色 | 说明 |
|------|------|
| 🔗 **图论玩法** | BFS 能量分发，构建节点 → 连线网络，管理能量流动 |
| 🏗️ **11 种节点** | 核心 · 能量站 · 炮塔 · 矿机 · 护盾 · 中继器 · 连锁塔 · 信标 · 工厂 · 磁力塔 · 陷阱 |
| ⚔️ **7 种敌人** | 侦察兵 · 重型 · 蜂群 · 隐匿者 · 分裂者 · 干扰者 · Boss |
| 🗺️ **8 个关卡** | 存活 · Boss战 · 限时挑战，逐关解锁 |
| 🔬 **科技树** | 9 项科技，3 层深度，跨关持久 |
| 🏆 **成就系统** | 15 项成就，Toast 通知 + 面板查看 |
| 🌫️ **战争迷雾** | 探索未知区域，策略性布局 |
| ⛅ **天气 & 地形** | 星云减速 · 小行星障碍 · 虫洞传送 |
| 🎨 **霓虹科幻美学** | 纯 Canvas 2D 渲染，程序化音效，零外部资源 |

---

## 🎮 操作

| 操作 | 方式 |
|------|------|
| 建造节点 | `1` - `0`, `-` 选择类型 → 点击空地放置 |
| 选中节点 | 左键**点击**节点 → 弹出弧形菜单 |
| 连接节点 | 左键从节点**拖拽**到目标节点 / 弧形菜单「连线」按钮 |
| 框选节点 | `Shift` + 左键拖拽矩形 |
| 升级 / 出售 | `U` / `X` 或弧形菜单按钮 |
| 平移地图 | `Ctrl` + 左键拖拽 |
| 缩放地图 | 鼠标滚轮 |
| 切换连线类型 | `Tab` |
| 科技树 / 成就 | `T` / `A` |
| 暂停 / 加速 | `P` / `G` (1×/2×/3×) |
| 快捷键设置 | `K` |
| 静音 | `M` |

---

## 🏗️ 节点一览

| 节点 | 费用 | 能力 |
|------|------|------|
| ⭐ 核心 | 200◆ | 产生能量 (15/tick)，可扩展领地 |
| ⚡ 能量站 | 30◆ | 中继并放大能量传输 |
| ⊕ 炮塔 | 50◆ | 自动瞄准攻击敌人 |
| ⛏ 矿机 | 40◆ | 产出额外资源 |
| ◈ 护盾 | 60◆ | 减免附近节点伤害 |
| ◎ 中继器 | 20◆ | 低成本能量转发 |
| ☇ 连锁塔 | 65◆ | 电网 AoE 伤害 |
| 📡 信标 | 35◆ | 揭示大范围迷雾 |
| 🏭 工厂 | 80◆ | 生成防御无人机 |
| 🧲 磁力塔 | 45◆ | 减速附近敌人 |
| 💣 陷阱 | 55◆ | 一次性范围爆炸 |

> 节点可升级至 5 级，满级后可**进化**为高级形态（消耗晶体 ✧）

---

## ⚔️ 战斗流程

```
开局 20s 空窗期 → 建立防御网络
         ↓
第一波敌人刷新 → 每 15s 递增波次
         ↓
敌人类型逐步解锁 → Boss 波次触发
         ↓
胜利条件: 存活 N 波 / 击杀 Boss / 限时坚守
```

---

## 🚀 快速开始

```bash
git clone https://github.com/falling-feather/Starfield_Nodes.git
cd Starfield_Nodes
npm install
npm run dev       # 开发服务器 → http://localhost:5173/
```

```bash
npm run build     # 构建产物 → dist/
npm run preview   # 预览构建
```

---

## 🔧 技术栈

- **Vite 8** — 构建与 HMR
- **TypeScript** — 严格类型
- **Canvas 2D API** — 原生渲染，零框架依赖
- **Web Audio API** — 程序化音效生成，零音频文件
- **算法**: BFS 能量分发 · 泊松圆盘采样 · 加权目标选择

## 📂 项目结构

```
src/
├── main.ts          # 入口：登录 → 选关 → 选卡 → 过场 → 游戏
├── game.ts          # 游戏主循环：帧更新、Tick 逻辑、胜利条件
├── types.ts         # 核心类型、接口、常量
├── input.ts         # 鼠标/键盘输入、建造/连线/框选/平移
├── renderer.ts      # 世界渲染：星空、节点、边、敌人、粒子、迷雾
├── ui.ts            # HUD/菜单/弧形菜单/科技/成就面板
├── graph.ts         # 图论算法：能量流动、连通性、地形效果
├── entities.ts      # 敌人生成/AI、节点创建、飞弹碰撞
├── particles.ts     # 粒子系统（爆炸/命中/死亡特效）
├── levels.ts        # 6 个关卡配置
├── tech.ts          # 9 项科技定义
├── achievements.ts  # 15 项成就检测
├── audio.ts         # Web Audio 程序化音效
├── fog.ts           # 战争迷雾 OffscreenCanvas
├── keybinds.ts      # 快捷键映射与自定义
├── tutorial.ts      # 分步教程系统
├── save.ts          # localStorage 存档管理
├── login.ts         # 登录/档案管理
├── level-select.ts  # 关卡选择菜单
├── node-select.ts   # PvZ 风格选卡界面
└── cutscene.ts      # 过场动画
```

## 📖 文档

详细开发文档见 [`doc/DEVELOPMENT.md`](doc/DEVELOPMENT.md)，涵盖架构设计、系统详解、实体数据、关卡配置等。

项目长期规划与优化路线见 [`doc/PROJECT_ROADMAP.md`](doc/PROJECT_ROADMAP.md)。

## License

MIT
