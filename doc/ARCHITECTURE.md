# 架构图

> 以下为 [Mermaid](https://mermaid.js.org/) 格式图表，可在 GitHub / VS Code Mermaid 插件中直接渲染。

---

## 1. 游戏流程

```mermaid
flowchart LR
    A[LoginScreen<br>登录/选档] --> B[LevelSelectScreen<br>选关]
    B --> C[NodeSelectScreen<br>选卡]
    C --> D[CutsceneScreen<br>过场动画]
    D --> E[Game<br>游戏主循环]
    E -->|胜利/失败| B
```

---

## 2. 模块依赖关系

```mermaid
graph TD
    main["main.ts<br>入口 & 流程编排"]
    game["game.ts<br>主循环 & Tick"]
    input["input.ts<br>输入处理"]
    renderer["renderer.ts<br>世界渲染"]
    ui["ui.ts<br>HUD & 菜单"]
    types["types.ts<br>类型 & 常量"]
    entities["entities.ts<br>实体逻辑"]
    graphMod["graph.ts<br>图论算法"]
    particles["particles.ts<br>粒子系统"]
    audio["audio.ts<br>音效"]
    fog["fog.ts<br>战争迷雾"]
    levels["levels.ts<br>关卡配置"]
    tech["tech.ts<br>科技树"]
    achievements["achievements.ts<br>成就"]
    keybinds["keybinds.ts<br>快捷键"]
    tutorial["tutorial.ts<br>教程"]
    save["save.ts<br>存档"]
    login["login.ts<br>登录"]
    levelsel["level-select.ts<br>选关"]
    nodesel["node-select.ts<br>选卡"]
    cutscene["cutscene.ts<br>过场"]

    main --> game
    main --> login
    main --> levelsel
    main --> nodesel
    main --> cutscene
    main --> levels

    game --> input
    game --> renderer
    game --> ui
    game --> entities
    game --> graphMod
    game --> audio
    game --> tech
    game --> achievements

    input --> graphMod
    input --> audio
    input --> keybinds
    input --> tutorial

    ui --> achievements
    ui --> keybinds
    ui --> audio
    ui --> tutorial

    renderer --> fog
    renderer --> particles

    entities --> particles

    login --> save

    types -.->|被所有模块引用| main

    style types fill:#2a2a4a,stroke:#00ffff,color:#fff
    style game fill:#1a3a1a,stroke:#00ff88,color:#fff
    style main fill:#3a1a1a,stroke:#ff8800,color:#fff
```

---

## 3. 游戏主循环 (Game Loop)

```mermaid
flowchart TD
    RAF["requestAnimationFrame"] --> DT["计算 deltaTime"]
    DT --> ACC["累积器 += deltaTime × timeScale"]
    ACC --> CHECK{累积器 ≥ 500ms?}
    CHECK -->|是| TICK["tick()"]
    TICK --> SUB["累积器 -= 500ms"]
    SUB --> CHECK
    CHECK -->|否| RENDER["render(deltaTime)"]
    RENDER --> RAF

    subgraph "tick() 逻辑更新"
        T1["能量分配 (BFS)"] --> T2["节点更新"]
        T2 --> T3["敌人更新"]
        T3 --> T4["飞弹碰撞"]
        T4 --> T5["粒子更新"]
        T5 --> T6["超载检测"]
        T6 --> T7{"tick ≥ 40?<br>(20s 空窗期)"}
        T7 -->|是| T8["敌人生成"]
        T7 -->|否| T9["跳过生成"]
        T8 --> T10["波次/胜负判定"]
        T9 --> T10
    end

    TICK --> T1
```

---

## 4. 能量流动系统

```mermaid
flowchart LR
    CORE["⭐ 核心<br>产出 15 能量/tick"]
    E1["⚡ 能量站"]
    E2["⊕ 炮塔"]
    E3["⛏ 矿机"]
    R1["◎ 中继器"]

    CORE -->|standard 8/tick| E1
    CORE -->|fast 14/tick| E2
    E1 -->|amplify +30%| E3
    E1 -->|heavy 20/tick| R1
    R1 -->|standard| E2

    style CORE fill:#ffaa00,stroke:#fff,color:#000
    style E1 fill:#00aaff,stroke:#fff,color:#fff
```

---

## 5. 输入交互状态机

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Panning: Ctrl+左键按下
    Idle --> NodeClickOrigin: 左键按下节点
    Idle --> Building: 数字键选择
    Idle --> BoxSelect: Shift+左键按下空地

    NodeClickOrigin --> DragConnect: 移动超过10px
    NodeClickOrigin --> RadialMenu: 左键释放(未拖拽)

    DragConnect --> TryConnect: 释放在目标节点上
    DragConnect --> Cancel: 释放在空白处
    TryConnect --> Idle

    RadialMenu --> ConnectMode: 点击"连线"按钮
    RadialMenu --> Upgrade: 点击"升级"
    RadialMenu --> Sell: 点击"出售"
    RadialMenu --> Idle: 点击空白关闭

    ConnectMode --> TryConnect: 点击目标节点
    ConnectMode --> Idle: 右键/Esc取消

    Building --> PlaceNode: 点击有效位置
    PlaceNode --> Building: 继续建造
    Building --> Idle: Esc取消

    Panning --> Idle: 释放
    BoxSelect --> BatchOps: 释放(选中节点)
    BoxSelect --> Idle: 释放(空选)
    BatchOps --> Idle

    Cancel --> Idle
    Upgrade --> Idle
    Sell --> Idle
```

---

## 6. 敌人生成与AI

```mermaid
flowchart TD
    SPAWN["每 N tick 生成一波"]
    SPAWN --> COUNT["数量 = 1 + floor(wave/3)"]
    COUNT --> POS["距存活节点 500-800 外随机位置"]
    POS --> TYPE["按波次解锁类型池随机选取"]

    TYPE --> AI{"敌人类型?"}

    AI -->|scout| NEAR["追踪最近节点"]
    AI -->|heavy| CORE_T["直扑核心<br>weight: core=0.3"]
    AI -->|swarm| NEAR
    AI -->|stealth| SNEAK["偷袭核心/能量站<br>core=0.4, energy=0.7"]
    AI -->|splitter| SPLIT["死亡分裂 2-3 个小体"]
    AI -->|disruptor| CUT["切断连线<br>relay=0.3, core=0.9"]
    AI -->|boss| BOSS["优先核心/炮塔<br>core=0.35, turret=0.7"]
```

---

## 7. 科技树

```mermaid
graph TD
    T1A["高效链路<br>150◆ | 边吞吐+4"]
    T1B["强化结构<br>200◆ | HP+30%"]
    T1C["核心超频<br>180◆ | 产能+10"]

    T2A["等离子炮塔<br>300◆ | 伤害×1.5"]
    T2B["量子中继<br>250◆ | 距离+80"]
    T2C["能量矩阵<br>280◆ | 容量×1.4"]
    T2D["纳米修复<br>350◆ | HP 自恢复"]

    T3A["经济繁荣<br>500◆ | 成本×0.7"]
    T3B["狙击协议<br>450◆ | 射程×1.6"]

    T1A --> T2A
    T1A --> T2B
    T1C --> T2C
    T1B --> T2D

    T2A --> T3A
    T2C --> T3A
    T2A --> T3B
    T2B --> T3B

    style T1A fill:#1a3a5a,stroke:#00aaff,color:#fff
    style T1B fill:#1a3a5a,stroke:#00aaff,color:#fff
    style T1C fill:#1a3a5a,stroke:#00aaff,color:#fff
    style T2A fill:#2a1a4a,stroke:#aa55ff,color:#fff
    style T2B fill:#2a1a4a,stroke:#aa55ff,color:#fff
    style T2C fill:#2a1a4a,stroke:#aa55ff,color:#fff
    style T2D fill:#2a1a4a,stroke:#aa55ff,color:#fff
    style T3A fill:#4a1a1a,stroke:#ff5555,color:#fff
    style T3B fill:#4a1a1a,stroke:#ff5555,color:#fff
```

---

## 8. 关卡解锁路径

```mermaid
graph LR
    L1["1. 初始星域<br>survive W10<br>×0.8"]
    L2["2. 边境前哨<br>survive W15<br>×1.0"]
    L3["3. 迷雾深处<br>boss W20<br>×1.2"]
    L4["4. 闪电突袭<br>timed 180s<br>×1.5"]
    L5["5. 多核心战役<br>survive W20<br>×1.3"]
    L6["6. 虫巢终焉<br>boss W25<br>×1.8"]

    L1 --> L2
    L2 --> L3
    L2 --> L4
    L3 --> L5
    L5 --> L6

    style L1 fill:#0a2a0a,stroke:#00ff88,color:#fff
    style L6 fill:#3a0a0a,stroke:#ff4444,color:#fff
```
