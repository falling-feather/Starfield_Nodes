# 第 9 波死亡墙诊断报告（Death Wall @ Wave 9）

> 输入：[doc/bench-reports/bench-report-long.md](./bench-reports/bench-report-long.md)（5 pool × 5 seed × 5 level × waves=20，125 runs）  
> HEAD = `6b49440`（Phase E 收口后）

## TL;DR

第 8 → 9 波之间发生大规模团灭，**所有 5 个 pool 的存活样本数锐减 50–80%**，且 avgWave 全部落在 8.48–8.88 之间，标准差仅 ~1.1。这不是某个 pool 的问题，而是**全局难度曲线问题**。

诊断结论：**敌人 spawn 量在 wave 6 后呈近指数增长（每波 +18~25），而玩家 nodeCount 增长被资源 / 建造速度 / 节点上限三重夹住，没有任何一个 pool 能在 wave 9 前完成防御纵深扩展**。

## 一、存活率曲线（按 pool × wave 的样本数 n）

| wave \ pool | balanced | noMine | noShield | turretRush | shieldDefense |
|---:|--:|--:|--:|--:|--:|
| 1–6 | 25 | 25 | 25 | 25 | 25 (除 sd 23) |
| 7 | 21 | 23 | 21 | 20 | 18 |
| 8 | 17 | 15 | 17 | 12 | 12 |
| **9** | **6** | **8** | **6** | **3** | **7** |
| 10 | 1 | 1 | 1 | 2 | 1 |
| 11+ | 0 | 0 | 0 | 0 | 1 |

- **wave 7 → 8**：存活率 ~85% → ~70%（首次明显流失）
- **wave 8 → 9**：~70% → ~25%（**断崖式死亡墙**）
- **wave 9 → 10**：~25% → ~5%（继续清扫）

5 pool 的 wave 6 之前几乎 100% 存活、wave 9 之后几乎 0% 存活，说明**死亡墙位置高度收敛**与 pool 选择无关。

## 二、敌人增长 vs 节点增长（avg 数据，全部 pool 取均值）

| wave | avgEnemy | avgNodes | enemy/node | Δenemy | Δnodes |
|---:|--:|--:|--:|--:|--:|
| 1 | 0 | 38.8 | 0.00 | — | — |
| 2 | 3 | 38.8 | 0.08 | +3 | 0 |
| 3 | 11 | 38.8 | 0.28 | +8 | 0 |
| 4 | 21 | 38.8 | 0.54 | +10 | 0 |
| 5 | 31 | 38.8 | 0.80 | +10 | 0 |
| 6 | 49 | 38.8 | 1.26 | +18 | 0 |
| 7 | 66 | 40.0 | 1.65 | +17 | +1.2 |
| 8 | 90 | 42.9 | 2.10 | +24 | +2.9 |
| **9** | **115** | **44.3** | **2.60** | **+25** | **+1.4** |
| 10 | 150 | 55.0 | 2.73 | +35 | +10.7 |

关键比率 **enemy/node**：
- wave 5 = 0.80（玩家可控，每节点 0.8 敌人）
- wave 6 = 1.26（**首次 >1.0，进入"被压制"阶段**）
- wave 8 = 2.10（每节点 ~2 敌人，DPS 已饱和）
- wave 9 = 2.60（**死亡墙处，每节点要应对 ~2.6 敌人**）

## 三、得分增长（avgScore）

| wave | balanced | noMine | noShield | turretRush | shieldDefense | 总均 |
|---:|--:|--:|--:|--:|--:|--:|
| 5 | 2.8 | 4.4 | 3.8 | 4.2 | 2.8 | 3.6 |
| 6 | 6.4 | 4.8 | 9.6 | 4.6 | 8.0 | 6.7 |
| 7 | 13.8 | 10.0 | 16.9 | 13.3 | 11.4 | 13.1 |
| 8 | 15.3 | 16.3 | 26.2 | 24.2 | 29.6 | 22.3 |
| 9 | 64.2 | 47.5 | 90.8 | 128.3 | 70.7 | 80.3 |

**前 6 波累计杀敌得分 < 10**，意味着前 6 波几乎全是"挨打期"。第 9 波得分跳升到 50-130 是因为**这是死亡前的最后一波，玩家被迫释放积累的高 DPS 节点（mine/sniper/blackhole）一次性清屏，但来不及阻止核心被破坏**。

## 四、根因分析（4 项收敛证据）

### 1. 节点数增长被卡死

avgNodes 从 wave 1 的 38.8 到 wave 8 的 42.9，**7 波只 +4 个节点**。可能原因：
- **资源不足**：前期没有杀敌得分，资源仅靠 mine 自产（线性增长，远低于敌人指数增长）
- **建造速度受限**：玩家需要点击建造，每个节点都要花资源 + 选位
- **未触及节点上限**：直到 wave 10 才看到 nodeCount=55，说明上限够，但前期没钱建

### 2. 敌人 spawn 增量过激进

Δenemy：3 → 8 → 10 → 10 → 18 → 17 → 24 → 25 → 35。  
wave 5→6 突然从 +10 跳到 +18（**+80% 增量**），wave 7→8 从 +17 到 +24（**+41% 增量**），是 **spawnIntervalCurve / waveScaleCurve 在中期斜率过陡**。

### 3. DPS 提升跟不上敌人 HP/数量增长

第 5 波 score=3.6 → 第 7 波 score=13（**3.6×**），但 enemyCount 从 31 → 66（**2.1×**）。表面看 DPS 增长 > 数量增长，但 sd 极大（sd ≈ 4× mean）说明 **多数 run 几乎不杀，少数 run 大杀**——表明 DPS 输出存在阈值现象（够 / 不够），没有渐进性。

### 4. shieldDefense pool 不优于 noShield

| pool | avgWave | avgScore |
|---|--:|--:|
| noShield | 8.80 | 30.8 |
| shieldDefense | 8.48 | 29.8 |

护盾投资**完全没有救回死亡墙**（avgWave 反而少 0.32）。说明此版本下 shield 节点的"治疗 / armor"输出远低于敌人 DPS，shield 本身被秒，护盾纵深无法形成。

## 五、可执行调优建议（按预期收益排序）

### 高优先级（直接拉平死亡墙）

1. **降低 wave 6→9 spawn 增量斜率**（[src/data/balance.ts](../src/data/balance.ts) 或 spawn 逻辑）
   - 把 Δenemy 曲线从 `+18 → +17 → +24 → +25` 拉平到 `+12 → +14 → +16 → +18`
   - 预期效果：wave 9 enemy/node 从 2.60 降到 ~1.8，玩家有喘息时间
   - 实施成本：低（单数值调整）

2. **提高玩家中前期资源积累速度**
   - mine 自产 / kill rewards 在 wave 4–6 间提速（如 mine evolved 提前到 level 4 解锁）
   - 或全局加 wave 5 后的"resourceBonusPerWave"
   - 预期效果：wave 7-8 nodeCount 多 +5~10
   - 实施成本：低-中

### 中优先级（结构性改善）

3. **shield 节点强化**：  
   `COMBAT.shield.healAmount.n` 从 5 提到 8 / `evolvedArmorHealPerTick` 从 3 提到 6  
   把 shieldDefense pool 的 avgWave 拉到 9.5+，让"防御流"成为可行策略

4. **boss 出现时机延后**：  
   bench 数据 wave 9 enemy=115，其中应有 boss 出现，进一步压垮玩家

### 低优先级（数据观测改善）

5. **bench-report 新增 perWave kills/spent/built 字段**  
   现在只能看 score/enemy/node，**资源花费 / 建造数 / 击杀数都看不到**，调优靠瞎猜

## 六、下一步建议

- 先做 **第 1 项**（spawn 曲线拉平）+ **第 2 项**（资源加速），跑加长 sweep 对比 avgWave。如果 avgWave 拉到 12+，说明诊断方向正确。
- 在改动前先把当前 baseline 数据归档为 `doc/bench-reports/bench-report-long-pre-balance.md` 作为 A/B 基线。
