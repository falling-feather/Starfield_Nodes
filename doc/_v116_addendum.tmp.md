

## §V1.1.6 联动图鉴面板（2026-04-28 增补 · Phase β-5）

### 背景

V1.1.2-V1.1.5 上线了 4 对节点联动（buffer×collector / portal×interceptor / tesla×relay / shield×repair），覆盖加成 / 事件 / 扩展 / 减免四种机制模式。但这些联动是「隐藏机制」：玩家只能从 edge 高亮色 + 战斗结果反推规律，不一定能感知到。本次 V1.1.6 把它们做成显式图鉴。

### 实现

#### 快捷键 src/keybinds.ts

- 新增 `KeyAction = 'synergy'`，默认按键 `y`，标签 `联动图鉴`
- 与现有 `a/t/k/p/m/r/g/u/x` 不冲突，可在按键设置面板自定义

#### UI 层 src/ui.ts

- 新字段 `showSynergyPanel: boolean` + `synergyFade` 进度，仿 `showAchievementPanel` 三件套
- 新方法 `drawSynergyPanel(state)`：600×440 浮层 + 4 张联动卡片
- 静态数据 `SYNERGIES[]`：每条包含 `pair / name / mode / effect / unlock / color`，颜色与 renderer.ts 的 edge 高亮色一一对应（金 / 粉紫 / 青蓝 / 医疗白绿）
- 卡片左侧 4px identity bar 用联动专属色，玩家在战斗里看到边的颜色就能直接对应到图鉴

#### 输入层 src/input.ts

- `action === 'synergy'` 切换 `showSynergyPanel`
- HUD 顶栏右侧操作提示行新增 `[Y]图鉴`

### 设计取舍

- **静态展示而非「已发现/未发现」机制**：4 对联动数量少、解锁关明确，不做发现追踪可避免增加 `state.discoveredSynergies` 存档字段；后续若联动数 ≥ 8 再考虑
- **不挂在暂停菜单里**：图鉴是查询性质，玩家可能在战斗中临时想确认机制，做成独立面板（不暂停游戏）更好用
- **颜色编码强一致**：图鉴卡片色 = renderer.ts edge 高亮色 = 玩家在场上看到的颜色，三层一致是可读性的关键
- **mode 标签四类「加成/事件/扩展/减免」直接显示**：让玩家意识到这是一组系统化机制而不是零散彩蛋，为未来扩展第 5/6 对联动留好脚手架

### 验证

| 项目 | 结果 |
|---|---|
| TypeScript 类型检查 | OK 0 错误 |
| `npm run build` | OK 121ms，bundle 178.75 KB（V1.1.5 +2.51 KB） |
| Tab/Y 键切换面板 | OK action handler 命中 |
| 4 张卡片渲染 | TODO 浏览器实测（与 V1.1.2-V1.1.5 一并在 L3 时回归） |

### 后续

- 玩家进入 L2/L3 后回归：图鉴可读性 + 4 对联动视觉的整体观感
- 第 5/6 对联动候选：energy × buffer 共振（能量塔放电时回血邻居 buffer）、relay × energy 网络化（relay 串联 energy 触发广域 buff）
- 当联动数 ≥ 6 时考虑加「已发现」标记 + 解锁动画
