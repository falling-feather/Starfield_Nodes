// ===== 输入交互系统 =====
import type { GameState, NodeType, EdgeType } from './types';
import { EXPAND_COST, EXPAND_CRYSTAL_COST } from './data/runtime';
import { EVOLUTION_LEVEL, EVOLVABLE_TYPES, getEvolutionCost, getEvolutionCrystalCost } from './data/evolution';
import { NODE_CONFIGS } from './data/nodes';
import { EDGE_CONFIGS } from './data/edges';
import { ECONOMY } from './data/balance';
import { canConnect, createEdge, createNode, dist, getTerritoryDiscount } from './graph';
import type { TechState } from './tech';
import { researchTech } from './tech';
import { sfxBuild, sfxSell, sfxConnect, initAudio, toggleMute } from './audio';
import type { UI } from './ui';
import { getActionForKey, getKey } from './keybinds';
import { isTutorialActive, advanceTutorial, skipTutorial } from './tutorial';

export type BuildMode = NodeType | null;

const EDGE_TYPES: EdgeType[] = ['standard', 'fast', 'heavy', 'amplify'];

export class InputManager {
  private state: GameState;
  private buildMode: BuildMode = null;
  private onRestart: () => void;
  /** V1.1.0：暂停菜单触发的"返回选卡"与"返回标题"回调 */
  private onExitToLevelSelect: (() => void) | null;
  private onExitToTitle: (() => void) | null;
  techState: TechState;
  allowedNodeTypes: NodeType[] | null = null;
  // 摄像机拖拽
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private panCamStartX: number = 0;
  private panCamStartY: number = 0;
  // 框选
  private isBoxSelecting: boolean = false;
  boxSelectStart: { x: number; y: number } | null = null;
  boxSelectEnd: { x: number; y: number } | null = null;
  /** 潜在框选的起始位置（屏幕+世界坐标） */
  private dragOrigin: { sx: number; sy: number; wx: number; wy: number } | null = null;
  /** 节点点击起始信息（用于区分点击与拖拽） */
  private nodeClickOrigin: { nodeId: string; sx: number; sy: number } | null = null;
  private isDraggingNode: boolean = false;
  // 用于清理的引用
  private canvas: HTMLCanvasElement;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundContextMenu: (e: Event) => void;
  private ui: UI | null;

  constructor(
    canvas: HTMLCanvasElement,
    state: GameState,
    onRestart: () => void,
    techState: TechState,
    ui?: UI,
    onExitToLevelSelect?: () => void,
    onExitToTitle?: () => void,
  ) {
    this.state = state;
    this.onRestart = onRestart;
    this.onExitToLevelSelect = onExitToLevelSelect ?? null;
    this.onExitToTitle = onExitToTitle ?? null;
    this.techState = techState;
    this.canvas = canvas;
    this.ui = ui ?? null;

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('mousedown', this.boundMouseDown);
    canvas.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('mouseup', this.boundMouseUp);
    canvas.addEventListener('contextmenu', this.boundContextMenu);
    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    window.addEventListener('keydown', this.boundKeyDown);
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
    this.canvas.removeEventListener('wheel', this.boundWheel);
    window.removeEventListener('keydown', this.boundKeyDown);
  }

  /** 将屏幕坐标转为世界坐标 */
  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.state.camera;
    return {
      x: sx / cam.zoom + cam.x,
      y: sy / cam.zoom + cam.y,
    };
  }

  private getNodeAtPos(wx: number, wy: number): string | null {
    for (const node of this.state.nodes) {
      if (node.status === 'destroyed') continue;
      if (dist(node, { x: wx, y: wy }) <= node.radius + 5) {
        return node.id;
      }
    }
    return null;
  }

  private onMouseDown(e: MouseEvent): void {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // V1.1.0：暂停菜单打开时独占左键点击
    if (e.button === 0 && this.ui?.pauseMenuOpen) {
      const hit = this.ui.pauseMenuAreas.find(
        a => sx >= a.x && sx <= a.x + a.w && sy >= a.y && sy <= a.y + a.h,
      );
      if (hit) {
        this.ui.pauseMenuIndex = hit.idx;
        this.triggerPauseMenu(hit.idx);
      }
      return;
    }

    // V1.0.6：科技树打开时拦截左键点击 → 点中可研究卡片则研究，未命中也不透过到画布
    if (e.button === 0 && this.techState.showPanel && this.ui) {
      const hit = this.ui.techCardAreas.find(
        a => sx >= a.x && sx <= a.x + a.w && sy >= a.y && sy <= a.y + a.h,
      );
      if (hit && hit.available) {
        researchTech(hit.techId, this.techState, this.state);
      }
      return;
    }

    // Ctrl + 左键 拖拽平移摄像机
    if (e.button === 0 && e.ctrlKey) {
      this.isPanning = true;
      this.dragOrigin = null;
      this.panStartX = sx;
      this.panStartY = sy;
      this.panCamStartX = this.state.camera.targetX;
      this.panCamStartY = this.state.camera.targetY;
      return;
    }

    // 右键 / 中键 also pans (fallback)
    if (e.button === 2 || e.button === 1) {
      this.isPanning = true;
      this.dragOrigin = null;
      this.panStartX = sx;
      this.panStartY = sy;
      this.panCamStartX = this.state.camera.targetX;
      this.panCamStartY = this.state.camera.targetY;
      return;
    }

    if (e.button === 0) {
      const { x, y } = this.screenToWorld(sx, sy);

      // 检查HUD按钮点击（时间加速）
      if (this.ui) {
        const tsBtn = this.ui.nodeButtons.find(
          b => b.action === 'time_scale' && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h
        );
        if (tsBtn) {
          this.state.timeScale = this.state.timeScale >= 3 ? 1 : this.state.timeScale + 1;
          return;
        }
      }

      // 检查UI按钮点击（屏幕坐标）
      if (this.ui && this.state.selectedNodeId) {
        const btn = this.ui.nodeButtons.find(
          b => sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h
        );
        if (btn && btn.enabled) {
          if (btn.action === 'upgrade') {
            this.upgradeNode(this.state.selectedNodeId);
          } else if (btn.action === 'sell') {
            this.sellNode(this.state.selectedNodeId);
          } else if (btn.action === 'recruit') {
            this.recruitNode(this.state.selectedNodeId);
          } else if (btn.action === 'expand') {
            this.expandCore(this.state.selectedNodeId);
          } else if (btn.action === 'connect') {
            // 通过菜单进入连线模式
            this.state.draggingFrom = this.state.selectedNodeId;
            this.state.selectedNodeId = null;
          }
          return;
        }
      }

      // 检查批量操作面板按钮
      if (this.ui && this.state.selectedNodeIds.length > 0) {
        const btn = this.ui.nodeButtons.find(
          b => sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h
        );
        if (btn && btn.enabled) {
          if (btn.action === 'batch_upgrade') {
            this.batchUpgrade();
          } else if (btn.action === 'batch_sell') {
            this.batchSell();
          } else if (btn.action === 'batch_clear') {
            this.state.selectedNodeIds = [];
          }
          return;
        }
      }

      if (this.buildMode) {
        this.placeNode(x, y);
        return;
      }

      const nodeId = this.getNodeAtPos(x, y);
      if (nodeId) {
        // 连线模式中（由菜单"连线"按钮触发）：点击目标节点完成连线
        if (this.state.draggingFrom && this.state.draggingFrom !== nodeId) {
          if (canConnect(this.state, this.state.draggingFrom, nodeId)) {
            const edgeConf = EDGE_CONFIGS[this.state.selectedEdgeType];
            if (this.state.resources >= edgeConf.cost && this.state.crystals >= edgeConf.crystalCost) {
              const edge = createEdge(this.state.draggingFrom, nodeId, this.state.selectedEdgeType);
              this.state.edges.push(edge);
              this.state.resources -= edgeConf.cost;
              this.state.crystals -= edgeConf.crystalCost;
              sfxConnect();
            }
          }
          this.state.draggingFrom = null;
          return;
        }
        // 记录节点点击起始位置（后续在mouseUp时判断是点击还是拖拽）
        this.nodeClickOrigin = { nodeId, sx, sy };
        this.isDraggingNode = false;
        this.state.selectedNodeIds = [];
      } else {
        // 空白区域按下 → 取消连线模式 / Shift 框选
        if (this.state.draggingFrom) {
          this.state.draggingFrom = null;
          return;
        }
        if (e.shiftKey) {
          // Shift + 拖拽 → 框选
          this.dragOrigin = { sx, sy, wx: x, wy: y };
        } else {
          // 普通空白点击 → 取消选择
          this.state.selectedNodeId = null;
          this.state.selectedNodeIds = [];
        }
      }
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // 摄像机拖拽中
    if (this.isPanning) {
      const dx = (sx - this.panStartX) / this.state.camera.zoom;
      const dy = (sy - this.panStartY) / this.state.camera.zoom;
      this.state.camera.targetX = this.panCamStartX - dx;
      this.state.camera.targetY = this.panCamStartY - dy;
      // 限制在世界边界内
      this.clampCamera();
    }

    // 记录世界坐标用于拖拽连线预览等
    const world = this.screenToWorld(sx, sy);
    this.state.mouseX = world.x;
    this.state.mouseY = world.y;

    // 节点拖拽检测 → 超过阈值则进入连线模式（而非弹出菜单）
    if (this.nodeClickOrigin && !this.isDraggingNode) {
      const ddx = sx - this.nodeClickOrigin.sx;
      const ddy = sy - this.nodeClickOrigin.sy;
      if (ddx * ddx + ddy * ddy > 100) {
        this.isDraggingNode = true;
        this.state.draggingFrom = this.nodeClickOrigin.nodeId;
        this.state.selectedNodeId = null;
      }
    }

    // 拖拽阈值检测 → 激活框选
    if (this.dragOrigin && !this.isBoxSelecting) {
      const ddx = sx - this.dragOrigin.sx;
      const ddy = sy - this.dragOrigin.sy;
      if (ddx * ddx + ddy * ddy > 100) {
        this.isBoxSelecting = true;
        this.boxSelectStart = { x: this.dragOrigin.wx, y: this.dragOrigin.wy };
        this.boxSelectEnd = { x: world.x, y: world.y };
        this.state.selectedNodeId = null;
        this.state.selectedNodeIds = [];
        this.dragOrigin = null;
      }
    }

    // 框选更新
    if (this.isBoxSelecting) {
      this.boxSelectEnd = { x: world.x, y: world.y };
    }
  }

  private onMouseUp(e: MouseEvent): void {
    // 结束平移（右键/中键/Ctrl+左键）
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    // 节点拖拽结束 → 完成连线
    if (this.isDraggingNode && this.state.draggingFrom) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = this.screenToWorld(sx, sy);
      const targetId = this.getNodeAtPos(x, y);
      if (targetId && targetId !== this.state.draggingFrom) {
        if (canConnect(this.state, this.state.draggingFrom, targetId)) {
          const edgeConf = EDGE_CONFIGS[this.state.selectedEdgeType];
          if (this.state.resources >= edgeConf.cost && this.state.crystals >= edgeConf.crystalCost) {
            const edge = createEdge(this.state.draggingFrom, targetId, this.state.selectedEdgeType);
            this.state.edges.push(edge);
            this.state.resources -= edgeConf.cost;
            this.state.crystals -= edgeConf.crystalCost;
            sfxConnect();
          }
        }
      }
      this.state.draggingFrom = null;
      this.nodeClickOrigin = null;
      this.isDraggingNode = false;
      return;
    }

    // 节点点击（未拖拽）→ 弹出弧形菜单
    if (this.nodeClickOrigin && !this.isDraggingNode) {
      this.state.selectedNodeId = this.nodeClickOrigin.nodeId;
      this.state.draggingFrom = null;
      this.nodeClickOrigin = null;
      return;
    }

    // 框选结束
    if (this.isBoxSelecting && this.boxSelectStart && this.boxSelectEnd) {
      const x1 = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
      const y1 = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
      const x2 = Math.max(this.boxSelectStart.x, this.boxSelectEnd.x);
      const y2 = Math.max(this.boxSelectStart.y, this.boxSelectEnd.y);

      // 选中矩形内所有已连接且未摧毁的节点（排除核心）
      this.state.selectedNodeIds = this.state.nodes
        .filter(n => n.status !== 'destroyed' && n.connected && n.type !== 'core' &&
          n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2)
        .map(n => n.id);

      this.isBoxSelecting = false;
      this.boxSelectStart = null;
      this.boxSelectEnd = null;
      this.state.selectedNodeId = null;
      return;
    }

    // 空白区域点击（未达到拖拽阈值）→ 取消选择
    if (this.dragOrigin) {
      this.state.selectedNodeId = null;
      this.state.selectedNodeIds = [];
      this.dragOrigin = null;
      return;
    }

    // 连线模式下的mouseUp不再处理连线（已移动到mouseDown）
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    // 首次按键时初始化音频（需用户交互触发 AudioContext）
    initAudio();

    // 快捷键设置面板优先消费输入
    if (this.ui?.handleKeybindInput(key)) return;

    // 教程进行中：空格推进，Escape跳过
    if (isTutorialActive()) {
      if (key === ' ') {
        advanceTutorial();
        this.state.paused = false; // 解除暂停让游戏运行
        return;
      }
      if (key === 'escape') {
        skipTutorial();
        this.state.paused = false;
        return;
      }
      // 教程期间仍允许游戏操作（建造、连线等）
    }

    const action = getActionForKey(key);

    // V1.1.0：暂停菜单打开时独占输入
    if (this.ui?.pauseMenuOpen) {
      this.handlePauseMenuKey(key);
      return;
    }

    // V1.1.0：游戏失败时按重启键 → 直接返回选卡（不再原地重开本关）
    if (this.state.gameOver && action === 'restart') {
      if (this.onExitToLevelSelect) {
        this.onExitToLevelSelect();
      } else {
        this.onRestart();
      }
      return;
    }

    // 科技树开关
    if (action === 'techTree') {
      this.techState.showPanel = !this.techState.showPanel;
      if (this.techState.showPanel) {
        this.state.paused = true;
      }
      return;
    }

    // 科技树面板内的数字键 → 研究科技（V1.0.6：键 0 映射第10个科技）
    if (this.techState.showPanel) {
      let techIdx = -1;
      if (key >= '1' && key <= '9') techIdx = parseInt(key) - 1;
      else if (key === '0') techIdx = 9;
      if (techIdx >= 0 && techIdx < this.techState.tree.length) {
        researchTech(this.techState.tree[techIdx].id, this.techState, this.state);
      }
      if (key === 'escape') {
        this.techState.showPanel = false;
        this.state.paused = false;
      }
      return;
    }

    if (action === 'pause') {
      this.state.paused = !this.state.paused;
      return;
    }

    if (action === 'mute') {
      toggleMute();
      return;
    }

    if (action === 'achievements' && this.ui) {
      this.ui.showAchievementPanel = !this.ui.showAchievementPanel;
      return;
    }

    if (action === 'timeScale') {
      // 循环 1 → 2 → 3 → 1
      this.state.timeScale = this.state.timeScale >= 3 ? 1 : this.state.timeScale + 1;
      return;
    }

    // 快捷键设置面板
    if (key === 'k' && this.ui) {
      this.ui.showKeybindPanel = !this.ui.showKeybindPanel;
      this.ui.editingAction = null;
      return;
    }

    // 建造快捷键：优先使用 allowedNodeTypes 选择顺序动态绑定数字键 1..9,0（V1.0.5）
    // 未提供 allowedNodeTypes 时退回到原有24 键静态表（充当高阶、调试、 bench 场景默认）
    const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const buildMap: Record<string, NodeType> = {};
    if (this.allowedNodeTypes && this.allowedNodeTypes.length > 0) {
      // 动态按选择顺序绑定
      for (let i = 0; i < Math.min(numKeys.length, this.allowedNodeTypes.length); i++) {
        buildMap[numKeys[i]] = this.allowedNodeTypes[i];
      }
    } else {
      // 退回静态表
      Object.assign(buildMap, {
        '1': 'energy', '2': 'turret', '3': 'mine', '4': 'shield', '5': 'relay',
        '6': 'tesla', '7': 'core', '8': 'beacon', '9': 'factory', '0': 'magnet',
        '-': 'trap', '=': 'repair', '\\': 'sniper', ']': 'buffer', '[': 'collector',
        "'": 'interceptor', ';': 'radar', '`': 'portal', '.': 'blackhole', '/': 'echo',
        ',': 'toxin', 'q': 'arc', 'e': 'kamikaze',
      } as Record<string, NodeType>);
    }

    if (buildMap[key]) {
      const nodeType = buildMap[key];
      // 检查是否在允许列表中
      if (this.allowedNodeTypes && !this.allowedNodeTypes.includes(nodeType)) return;
      if (this.buildMode === nodeType) {
        this.buildMode = null; // 取消
      } else {
        this.buildMode = nodeType;
      }
      return;
    }

    // 升级
    if (action === 'upgrade' && this.state.selectedNodeId) {
      this.upgradeNode(this.state.selectedNodeId);
      return;
    }

    // 出售节点
    if (action === 'sell' && this.state.selectedNodeId) {
      this.sellNode(this.state.selectedNodeId);
      return;
    }

    // Tab 切换连线类型
    if (key === 'tab') {
      e.preventDefault();
      const idx = EDGE_TYPES.indexOf(this.state.selectedEdgeType);
      this.state.selectedEdgeType = EDGE_TYPES[(idx + 1) % EDGE_TYPES.length];
      return;
    }

    // ESC 取消 / 唤起暂停菜单（V1.1.0）
    if (key === 'escape') {
      // 优先级 1：取消上下文（连线/建造/选中节点）
      if (this.state.draggingFrom) {
        this.state.draggingFrom = null;
        return;
      }
      if (this.buildMode || this.state.selectedNodeId || this.state.selectedNodeIds.length > 0) {
        this.buildMode = null;
        this.state.selectedNodeId = null;
        this.state.selectedNodeIds = [];
        return;
      }
      // 优先级 2：游戏运行中（非 gameOver/levelWon/教程）→ 打开暂停菜单
      if (this.ui && !this.state.gameOver && !this.state.levelWon && !isTutorialActive()) {
        this.openPauseMenu();
      }
    }
  }

  /** V1.1.0：打开暂停菜单 */
  private openPauseMenu(): void {
    if (!this.ui) return;
    this.ui.pauseMenuOpen = true;
    this.ui.pauseMenuIndex = 0;
    this.state.paused = true;
  }

  /** V1.1.0：关闭暂停菜单 */
  private closePauseMenu(): void {
    if (!this.ui) return;
    this.ui.pauseMenuOpen = false;
    this.state.paused = false;
  }

  /** V1.1.0：暂停菜单内键盘处理 */
  private handlePauseMenuKey(key: string): void {
    if (!this.ui) return;
    const len = this.ui.pauseMenuItems.length;
    if (key === 'escape') {
      this.closePauseMenu();
      return;
    }
    if (key === 'arrowup' || key === 'w') {
      this.ui.pauseMenuIndex = (this.ui.pauseMenuIndex - 1 + len) % len;
      return;
    }
    if (key === 'arrowdown' || key === 's') {
      this.ui.pauseMenuIndex = (this.ui.pauseMenuIndex + 1) % len;
      return;
    }
    if (key >= '1' && key <= '9') {
      const idx = parseInt(key) - 1;
      if (idx < len) this.triggerPauseMenu(idx);
      return;
    }
    if (key === 'enter' || key === ' ') {
      this.triggerPauseMenu(this.ui.pauseMenuIndex);
      return;
    }
  }

  /** V1.1.0：执行暂停菜单某项 */
  private triggerPauseMenu(idx: number): void {
    if (!this.ui) return;
    const item = this.ui.pauseMenuItems[idx];
    if (!item) return;
    switch (item.action) {
      case 'resume':
        this.closePauseMenu();
        break;
      case 'restart':
        this.closePauseMenu();
        this.onRestart();
        break;
      case 'levels':
        this.closePauseMenu();
        if (this.onExitToLevelSelect) this.onExitToLevelSelect();
        break;
      case 'title':
        this.closePauseMenu();
        if (this.onExitToTitle) this.onExitToTitle();
        break;
    }
  }

  private placeNode(x: number, y: number): void {
    if (!this.buildMode) return;

    const cfg = NODE_CONFIGS[this.buildMode];
    // 领地折扣
    const discount = getTerritoryDiscount(this.state, x, y);
    const cost = Math.floor(cfg.cost * (1 - discount));
    if (this.state.resources < cost) return;

    // 检查是否与已有节点重叠
    for (const node of this.state.nodes) {
      if (node.status === 'destroyed') continue;
      if (dist(node, { x, y }) < node.radius + cfg.radius + 10) return;
    }

    // 检查世界边界
    if (x < 20 || x > this.state.worldWidth - 20 || y < 20 || y > this.state.worldHeight - 20) return;

    const node = createNode(x, y, this.buildMode);
    this.state.nodes.push(node);
    this.state.resources -= cost;
    // §25 bench instrumentation：记录玩家建造行为
    this.state.nodesBuilt += 1;
    this.state.resourcesSpent += cost;
    sfxBuild();
    this.buildMode = null;
  }

  /** 建造模式下获取当前鼠标位置的放置状态 */
  getBuildPlacementStatus(): { valid: boolean; reason: string; cost: number; discount: number } | null {
    if (!this.buildMode) return null;
    const cfg = NODE_CONFIGS[this.buildMode];
    const x = this.state.mouseX;
    const y = this.state.mouseY;
    const discount = getTerritoryDiscount(this.state, x, y);
    const cost = Math.floor(cfg.cost * (1 - discount));

    if (this.state.resources < cost) return { valid: false, reason: '资源不足', cost, discount };

    for (const node of this.state.nodes) {
      if (node.status === 'destroyed') continue;
      if (dist(node, { x, y }) < node.radius + cfg.radius + 10) {
        return { valid: false, reason: '距离太近', cost, discount };
      }
    }

    if (x < 20 || x > this.state.worldWidth - 20 || y < 20 || y > this.state.worldHeight - 20) {
      return { valid: false, reason: '超出边界', cost, discount };
    }

    return { valid: true, reason: '', cost, discount };
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const cam = this.state.camera;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    cam.targetZoom = Math.max(0.3, Math.min(2.0, cam.targetZoom * zoomFactor));
    this.clampCamera();
  }

  private clampCamera(): void {
    const cam = this.state.camera;
    const viewW = this.state.canvasWidth / cam.targetZoom;
    const viewH = this.state.canvasHeight / cam.targetZoom;
    // 允许一点溢出方便看边缘
    const margin = 100;
    cam.targetX = Math.max(-margin, Math.min(this.state.worldWidth - viewW + margin, cam.targetX));
    cam.targetY = Math.max(-margin, Math.min(this.state.worldHeight - viewH + margin, cam.targetY));
  }

  private upgradeNode(nodeId: string): void {
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'core') return;
    if (!node.connected) return; // 未连接节点不可升级

    // 已到满级且可进化 → 进化
    if (node.level >= EVOLUTION_LEVEL && !node.evolved && EVOLVABLE_TYPES.has(node.type)) {
      this.evolveNode(node);
      return;
    }

    // 满级且已进化 → 不能再升
    if (node.level >= EVOLUTION_LEVEL) return;

    const cost = ECONOMY.upgradeBaseCost * node.level;
    if (this.state.resources < cost) return;

    node.level++;
    node.maxEnergy = Math.floor(NODE_CONFIGS[node.type].maxEnergy * (1 + node.level * ECONOMY.upgradeEnergyGrowth));
    node.maxHp = Math.floor(NODE_CONFIGS[node.type].maxHp * (1 + node.level * ECONOMY.upgradeHpGrowth));
    node.hp = node.maxHp;
    this.state.resources -= cost;
  }

  private evolveNode(node: GameState['nodes'][0]): void {
    const cost = getEvolutionCost(node.type);
    const crystalCost = getEvolutionCrystalCost(node.type);
    if (this.state.resources < cost || this.state.crystals < crystalCost) return;

    node.evolved = true;
    this.state.resources -= cost;
    this.state.crystals -= crystalCost;

    // 进化奖励：ECONOMY.evolutionAttrGrowth 倍 maxEnergy/maxHp，恢复满HP
    node.maxEnergy = Math.floor(node.maxEnergy * ECONOMY.evolutionAttrGrowth);
    node.maxHp = Math.floor(node.maxHp * ECONOMY.evolutionAttrGrowth);
    node.hp = node.maxHp;

    sfxBuild(); // 用build音效表示进化完成
  }

  private sellNode(nodeId: string): void {
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (!node || node.status === 'destroyed') return;
    if (!node.connected && node.type !== 'core') return; // 未连接非核心节点不可出售

    // 核心：至少保留一个存活核心
    if (node.type === 'core') {
      const aliveCores = this.state.nodes.filter(n => n.type === 'core' && n.status !== 'destroyed');
      if (aliveCores.length <= 1) return;
    }

    // 返还 50% 建造费用 + 升级投入 + 进化投入
    const baseCost = NODE_CONFIGS[node.type].cost;
    let totalInvested = baseCost;
    for (let lv = 1; lv < node.level; lv++) {
      totalInvested += 30 * lv;
    }
    if (node.evolved) {
      totalInvested += getEvolutionCost(node.type);
    }
    const refund = Math.floor(totalInvested * 0.5);
    this.state.resources += refund;

    // 移除该节点的所有连线
    this.state.edges = this.state.edges.filter(
      e => e.sourceId !== nodeId && e.targetId !== nodeId
    );

    // 标记为已摧毁（保留残骸视觉）
    node.status = 'destroyed';
    node.currentEnergy = 0;
    node.hp = 0;
    sfxSell();

    this.state.selectedNodeId = null;
  }

  /** 招募中立节点 */
  private recruitNode(nodeId: string): void {
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (!node || node.owner !== 'neutral') return;
    const cost = NODE_CONFIGS[node.type].cost;
    if (this.state.resources < cost) return;
    this.state.resources -= cost;
    node.owner = 'player';
    sfxBuild();
  }

  /** 核心扩展卡 — 扩大领地范围 */
  private expandCore(nodeId: string): void {
    const node = this.state.nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'core' || node.expanded) return;
    if (this.state.resources < EXPAND_COST || this.state.crystals < EXPAND_CRYSTAL_COST) return;
    this.state.resources -= EXPAND_COST;
    this.state.crystals -= EXPAND_CRYSTAL_COST;
    node.expanded = true;
    sfxBuild();
  }

  private batchUpgrade(): void {
    for (const id of [...this.state.selectedNodeIds]) {
      this.upgradeNode(id);
    }
  }

  private batchSell(): void {
    for (const id of [...this.state.selectedNodeIds]) {
      this.sellNode(id);
    }
    this.state.selectedNodeIds = [];
  }

  getBuildMode(): BuildMode {
    return this.buildMode;
  }
}
