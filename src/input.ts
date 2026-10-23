import type { ActionResult, PlacementStatus } from './construction';
import { isPositionVisible } from './visibility';
import { minimapRect } from './canvas-ui';
// ===== 输入交互系统 =====
import type { GameState, NodeType, EdgeType } from './types';
import { EXPAND_COST, EXPAND_CRYSTAL_COST } from './data/runtime';
import { dist } from './graph';
import type { TechState } from './tech';
import { researchTech } from './tech';
import {
  placementStatus,
  buildNode,
  connectNodes,
  upgradeNode as upgradeBuilding,
  recruitNode as recruitBuilding,
  sellNode as recycleBuilding,
  nearestConnection,
} from './construction';
import { sfxBuild, sfxSell, sfxConnect, initAudio, toggleMute } from './audio';
import type { UI } from './ui';
import { getActionForKey } from './keybinds';
import { isTutorialActive, advanceTutorial, skipTutorial } from './tutorial';
import { PolygonEditor } from './polygon-editor';

export type BuildMode = NodeType | null;

const EDGE_TYPES: EdgeType[] = ['standard', 'fast', 'heavy', 'amplify'];

export class InputManager {
  private pausedBeforePanel = false;
  private pausedBeforeMenu = false;
  private pointerX = 0;
  private pointerY = 0;

  private state: GameState;
  private buildMode: BuildMode = null;
  private onRestart: () => void;
  /** V1.1.0：暂停菜单触发的"返回选卡"与"返回标题"回调 */
  private onExitToLevelSelect: (() => void) | null;
  private onExitToTitle: (() => void) | null;
  techState: TechState;
  allowedNodeTypes: NodeType[] | null = null;
  /** V1.3.2 dev-only 多边形地形编辑器 */
  polygonEditor: PolygonEditor = new PolygonEditor();
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
      if (
        node.status === 'destroyed' ||
        (node.owner === 'neutral' && !isPositionVisible(this.state, node.x, node.y))
      )
        continue;
      if (dist(node, { x: wx, y: wy }) <= node.radius + 5) {
        return node.id;
      }
    }
    return null;
  }

  updatePointerWorld(): void {
    const world = this.screenToWorld(this.pointerX, this.pointerY);
    this.state.mouseX = world.x;
    this.state.mouseY = world.y;
  }

  private closePanel(): void {
    if (!this.ui) return;
    this.techState.showPanel = false;
    this.ui.showKnowledgePanel = false;
    this.ui.showAchievementPanel = false;
    this.ui.showSynergyPanel = false;
    this.ui.showKeybindPanel = false;
    this.ui.editingAction = null;
    this.state.paused = this.pausedBeforePanel || isTutorialActive();
  }

  private togglePanel(kind: 'tech' | 'knowledge' | 'achievement' | 'synergy' | 'keybind'): void {
    if (!this.ui || (kind === 'tech' && (this.state.gameOver || this.state.levelWon))) return;
    const same =
      kind === 'tech'
        ? this.techState.showPanel
        : kind === 'knowledge'
          ? this.ui.showKnowledgePanel
          : kind === 'achievement'
            ? this.ui.showAchievementPanel
            : kind === 'synergy'
              ? this.ui.showSynergyPanel
              : this.ui.showKeybindPanel;
    if (same) {
      this.closePanel();
      return;
    }
    const wasOpen = this.ui.hasOpenSubPanel();
    if (!wasOpen) this.pausedBeforePanel = this.state.paused;
    this.cancelPointerInteractions();
    this.closePanel();
    if (kind === 'tech') this.techState.showPanel = true;
    else if (kind === 'knowledge') this.ui.showKnowledgePanel = true;
    else if (kind === 'achievement') this.ui.showAchievementPanel = true;
    else if (kind === 'synergy') this.ui.showSynergyPanel = true;
    else this.ui.showKeybindPanel = true;
    this.state.paused = true;
  }

  private cancelPointerInteractions(): void {
    this.isPanning = false;
    this.nodeClickOrigin = null;
    this.isDraggingNode = false;
    this.dragOrigin = null;
    this.isBoxSelecting = false;
    this.boxSelectStart = null;
    this.boxSelectEnd = null;
    this.state.draggingFrom = null;
  }

  resetInteractions(): void {
    this.buildMode = null;
    this.cancelPointerInteractions();
    this.pausedBeforePanel = false;
    this.pausedBeforeMenu = false;
  }

  private onMouseDown(e: MouseEvent): void {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    this.pointerX = sx;
    this.pointerY = sy;

    const closeButton = this.ui?.nodeButtons.find(
      (b) =>
        b.action === 'close_panel' && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h,
    );
    if (e.button === 0 && closeButton && this.ui?.hasOpenSubPanel() && !this.ui.pauseMenuOpen) {
      this.closePanel();
      return;
    }
    if (e.button === 0 && this.ui?.showKnowledgePanel && !this.ui.pauseMenuOpen) {
      const pageButton = this.ui.nodeButtons.find(button => button.enabled &&
        (button.action === 'knowledge_prev' || button.action === 'knowledge_next') &&
        sx >= button.x && sx <= button.x + button.w && sy >= button.y && sy <= button.y + button.h);
      if (pageButton) {
        this.ui.scrollKnowledgePanel(pageButton.action === 'knowledge_next' ? 1 : -1);
        return;
      }
    }
    if (
      e.button === 0 &&
      this.ui?.hasOpenSubPanel() &&
      !this.ui.isPointInOpenPanel(sx, sy) &&
      !this.ui.pauseMenuOpen
    ) {
      this.closePanel();
      return;
    }

    // V1.1.0：暂停菜单打开时独占左键点击
    if (e.button === 0 && this.ui?.pauseMenuOpen) {
      const hit = this.ui.pauseMenuAreas.find(
        (a) => sx >= a.x && sx <= a.x + a.w && sy >= a.y && sy <= a.y + a.h,
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
        (a) => sx >= a.x && sx <= a.x + a.w && sy >= a.y && sy <= a.y + a.h,
      );
      if (hit && hit.available) {
        researchTech(hit.techId, this.techState, this.state);
      }
      return;
    }

    if (e.button === 0 && this.ui?.showKeybindPanel) {
      const hit = this.ui.keybindAreas.find(
        (a) => sx >= a.x && sx <= a.x + a.w && sy >= a.y && sy <= a.y + a.h,
      );
      if (hit) {
        this.ui.editingAction = hit.action;
        this.ui.keybindMessage = '';
      }
      return;
    }
    if (this.ui?.hasOpenSubPanel() || this.ui?.pauseMenuOpen) return;

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
      // V1.3.3 编辑器激活 + 右键命中顶点 → 删除（不进入平移）
      if (e.button === 2 && this.polygonEditor.active) {
        const w = this.screenToWorld(sx, sy);
        const hitR = 14 / this.state.camera.zoom;
        if (this.polygonEditor.deleteVertexAt(w.x, w.y, hitR)) return;
      }
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

      // V1.3.2 多边形编辑器：左键添加顶点（独占）
      // V1.3.3：先尝试命中已有顶点 → 进入拖动；否则才追加新顶点
      if (this.polygonEditor.active) {
        const hitR = 12 / this.state.camera.zoom;
        const target = this.polygonEditor.findVertexAt(x, y, hitR);
        if (target) {
          this.polygonEditor.startDrag(target);
        } else {
          this.polygonEditor.addVertex(x, y);
        }
        return;
      }

      const button = this.ui?.nodeButtons.find(
        (b) => sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h,
      );
      if (button) {
        if (!button.enabled) return;
        const action = button.action;
        if (action.startsWith('build:')) {
          this.buildMode = action.slice(6) as NodeType;
          this.state.selectedNodeId = null;
          return;
        }
        if (action.startsWith('focus:')) {
          const id=action.slice(6),config=this.state.mission?.frontier;
          const point=config?.stations.find(s=>s.id===id)??config?.deposits.find(d=>d.id===id)??this.state.nodes.find(n=>n.id===id);
          if(point){
            this.cancelPointerInteractions();this.buildMode=null;this.state.selectedNodeId=null;
            const cam=this.state.camera;cam.targetZoom=Math.max(.8,cam.targetZoom);
            cam.targetX=point.x-this.state.canvasWidth/cam.targetZoom/2;
            cam.targetY=point.y-(this.state.canvasHeight+72-128)/cam.targetZoom/2;
            this.clampCamera();
          }
          return;
        }
        switch (action) {
          case 'overview': {
            this.cancelPointerInteractions();this.state.selectedNodeId=null;this.buildMode=null;
            if(this.ui)this.ui.objectiveCollapsed=true;
            const cam=this.state.camera;
            cam.targetZoom=Math.max(.3,Math.min((this.state.canvasWidth-90)/this.state.worldWidth,(this.state.canvasHeight-235)/this.state.worldHeight));
            cam.targetX=(this.state.worldWidth-this.state.canvasWidth/cam.targetZoom)/2;
            cam.targetY=(this.state.worldHeight-(this.state.canvasHeight+72-128)/cam.targetZoom)/2;
            this.clampCamera();break;
          }
          case 'objectives':
            if(this.ui)this.ui.objectiveCollapsed=!this.ui.objectiveCollapsed;
            break;
          case 'time_scale':
            this.state.timeScale = this.state.timeScale >= 3 ? 1 : this.state.timeScale + 1;
            break;
          case 'tech_tree':
            this.togglePanel('tech');
            break;
          case 'knowledge':
            this.togglePanel('knowledge');
            break;
          case 'pause':
            this.state.paused = isTutorialActive() || !this.state.paused;
            break;
          case 'menu':
            if (isTutorialActive()) skipTutorial();
            this.openPauseMenu();
            break;
          case 'edge_type': {
            const types: EdgeType[] = ['standard', 'fast', 'heavy', 'amplify'];
            this.state.selectedEdgeType =
              types[(types.indexOf(this.state.selectedEdgeType) + 1) % types.length];
            break;
          }
          case 'upgrade':
            if (this.state.selectedNodeId) this.upgradeNode(this.state.selectedNodeId);
            break;
          case 'auto_connect': {
            const node=this.state.nodes.find(n=>n.id===this.state.selectedNodeId);
            const source=node&&nearestConnection(this.state,node,this.techState);
            if(node&&source)this.connect(source.id,node.id);
            break;
          }
          case 'sell':
            if (this.state.selectedNodeId) this.sellNode(this.state.selectedNodeId);
            break;
          case 'recruit':
            if (this.state.selectedNodeId) this.recruitNode(this.state.selectedNodeId);
            break;
          case 'expand':
            if (this.state.selectedNodeId) this.expandCore(this.state.selectedNodeId);
            break;
          case 'connect':
            this.state.draggingFrom = this.state.selectedNodeId;
            this.state.selectedNodeId = null;
            break;
          case 'batch_upgrade':
            this.batchUpgrade();
            break;
          case 'batch_sell':
            this.batchSell();
            break;
          case 'batch_clear':
            this.state.selectedNodeIds = [];
            break;
          case 'continue':
            this.onExitToLevelSelect?.();
            break;
          case 'quick_restart':
            this.onRestart();
            break;
          case 'dismiss_alert':
            this.state.alert = undefined;
            break;
        }
        return;
      }
      const map = minimapRect(
        this.state.canvasWidth,
        this.state.canvasHeight,
        this.state.worldWidth,
        this.state.worldHeight,
      );
      if (sx >= map.x && sx <= map.x + map.w && sy >= map.y && sy <= map.y + map.h) {
        this.cancelPointerInteractions();
        this.state.selectedNodeId = null;
        this.state.selectedNodeIds = [];
        const cam = this.state.camera;
        cam.targetX =
          ((sx - map.x) / map.w) * this.state.worldWidth -
          this.state.canvasWidth / cam.targetZoom / 2;
        cam.targetY =
          ((sy - map.y) / map.h) * this.state.worldHeight -
          this.state.canvasHeight / cam.targetZoom / 2;
        this.clampCamera();
        return;
      }
      if (this.pointerHitsHud(sx, sy)) return;

      if (this.buildMode) {
        this.placeNode(x, y);
        return;
      }

      const nodeId = this.getNodeAtPos(x, y);
      if (nodeId) {
        // 连线模式中（由菜单"连线"按钮触发）：点击目标节点完成连线
        if (this.state.draggingFrom && this.state.draggingFrom !== nodeId) {
          this.connect(this.state.draggingFrom, nodeId);
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
    this.pointerX = sx;
    this.pointerY = sy;

    // V1.3.3 编辑器顶点拖动（独占）
    if (this.polygonEditor.active && this.polygonEditor.dragTarget) {
      const w = this.screenToWorld(sx, sy);
      this.polygonEditor.updateDrag(w.x, w.y);
      this.state.mouseX = w.x;
      this.state.mouseY = w.y;
      return;
    }

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
    if (this.ui?.hasOpenSubPanel() || this.ui?.pauseMenuOpen) {
      this.cancelPointerInteractions();
      return;
    }
    // V1.3.3 编辑器拖动结束（独占）
    if (this.polygonEditor.active && this.polygonEditor.dragTarget) {
      this.polygonEditor.endDrag();
      return;
    }

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
      this.pointerX = sx;
      this.pointerY = sy;
      if (this.pointerHitsHud(sx, sy)) {
        this.cancelPointerInteractions();
        return;
      }
      const { x, y } = this.screenToWorld(sx, sy);
      const targetId = this.getNodeAtPos(x, y);
      if (targetId && targetId !== this.state.draggingFrom) {
        this.connect(this.state.draggingFrom, targetId);
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
        .filter(
          (n) =>
            n.owner === 'player' &&
            n.status !== 'destroyed' &&
            n.connected &&
            n.type !== 'core' &&
            n.x >= x1 &&
            n.x <= x2 &&
            n.y >= y1 &&
            n.y <= y2,
        )
        .map((n) => n.id);

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

    // V1.3.2 多边形编辑器快捷键（dev-only，Ctrl+E 切换；激活后独占按键）
    if (import.meta.env?.DEV && e.ctrlKey && key === 'e') {
      e.preventDefault();
      this.polygonEditor.toggle();
      console.log('[PolygonEditor] active=' + this.polygonEditor.active);
      return;
    }
    if (this.polygonEditor.active) {
      if (e.ctrlKey && key === 's') {
        e.preventDefault();
        const json = this.polygonEditor.exportJSON();
        console.log('[PolygonEditor] terrainPolygons JSON ↓');
        console.log(json);
        try {
          void navigator.clipboard?.writeText(json);
        } catch {
          /* ignore */
        }
        return;
      }
      if (e.ctrlKey && key === 'd') {
        e.preventDefault();
        this.polygonEditor.clearAll();
        return;
      }
      if (e.ctrlKey && key === 'l') {
        e.preventDefault();
        this.polygonEditor.loadFromState(this.state);
        console.log(
          '[PolygonEditor] 已载入 state.terrainPolygons → drafts=' +
            this.polygonEditor.drafts.length,
        );
        return;
      }
      if (key === 'n') {
        this.polygonEditor.setType('nebula');
        return;
      }
      if (key === 'a') {
        this.polygonEditor.setType('asteroid');
        return;
      }
      if (key === 'w') {
        this.polygonEditor.setType('wormhole');
        return;
      }
      if (key === 'enter') {
        e.preventDefault();
        this.polygonEditor.closeCurrent();
        return;
      }
      if (key === 'backspace') {
        e.preventDefault();
        this.polygonEditor.undoVertex();
        return;
      }
      if (key === 'escape') {
        this.polygonEditor.cancelPending();
        return;
      }
      // 其余按键全部吞掉，避免误触建造/科技树
      return;
    }

    if (e.ctrlKey || e.metaKey) return;
    if (this.ui?.showKeybindPanel && !this.ui.editingAction && (key === 'k' || key === 'escape')) {
      e.preventDefault();
      this.closePanel();
      return;
    }
    if (this.ui?.handleKeybindInput(key)) {
      e.preventDefault();
      return;
    }
    const action = getActionForKey(key),
      terminal = this.state.gameOver || this.state.levelWon;
    if (e.shiftKey && key === 't') return;
    if (action) e.preventDefault();
    if (e.repeat && action !== 'upgrade') return;
    if (action === 'mute') {
      toggleMute();
      return;
    }
    if (this.ui?.pauseMenuOpen) {
      e.preventDefault();
      this.handlePauseMenuKey(key);
      return;
    }
    if (action === 'techTree') {
      this.togglePanel('tech');
      return;
    }
    if (action === 'achievements') {
      this.togglePanel('achievement');
      return;
    }
    if (action === 'synergy') {
      this.togglePanel('synergy');
      return;
    }
    if (key === 'h') {
      this.togglePanel('knowledge');
      return;
    }
    if (key === 'k') {
      this.togglePanel('keybind');
      return;
    }
    if (this.ui?.hasOpenSubPanel()) {
      if (key === 'escape') {
        this.closePanel();
        return;
      }
      if (
        key === 'tab' ||
        key === ' ' ||
        key.startsWith('arrow') ||
        key.startsWith('page') ||
        action ||
        /^[0-9]$/.test(key)
      )
        e.preventDefault();
      if (this.techState.showPanel && !terminal) {
        const index = key === '0' ? 9 : /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
        if (index >= 0 && index < this.techState.tree.length)
          researchTech(this.techState.tree[index].id, this.techState, this.state);
      }
      const direction =
        key === 'arrowdown' || key === 'pagedown'
          ? 1
          : key === 'arrowup' || key === 'pageup'
            ? -1
            : 0;
      if (direction) {
        const pixels = direction * (key.startsWith('page') ? 360 : 76);
        if (this.techState.showPanel) this.ui.scrollTechPanel(pixels);
        else if (this.ui.showKnowledgePanel) this.ui.scrollKnowledgePanel(pixels);
        else if (this.ui.showAchievementPanel) this.ui.scrollAchievementPanel(pixels);
        else if (this.ui.showSynergyPanel) this.ui.scrollSynergyPanel(pixels);
      }
      return;
    }
    if (isTutorialActive()) {
      if (key === ' ') {
        e.preventDefault();
        advanceTutorial();
        this.state.paused = isTutorialActive();
        return;
      }
      if (key === 'escape') {
        skipTutorial();
        this.state.paused = false;
        return;
      }
    }
    if (terminal) {
      if (key === 'enter') this.onExitToLevelSelect?.();
      else if (action === 'restart') this.onRestart();
      return;
    }
    if (action === 'pause') {
      this.state.paused = isTutorialActive() || !this.state.paused;
      return;
    }
    if (action === 'timeScale') {
      this.state.timeScale = this.state.timeScale >= 3 ? 1 : this.state.timeScale + 1;
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
        '1': 'energy',
        '2': 'turret',
        '3': 'mine',
        '4': 'shield',
        '5': 'relay',
        '6': 'tesla',
        '7': 'core',
        '8': 'beacon',
        '9': 'factory',
        '0': 'magnet',
        '-': 'trap',
        '=': 'repair',
        '\\': 'sniper',
        ']': 'buffer',
        '[': 'collector',
        "'": 'interceptor',
        ';': 'radar',
        '`': 'portal',
        '.': 'blackhole',
        '/': 'echo',
        ',': 'toxin',
        q: 'arc',
        e: 'kamikaze',
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
    this.cancelPointerInteractions();
    this.pausedBeforeMenu = this.state.paused;
    this.ui.pauseMenuOpen = true;
    this.ui.pauseMenuIndex = 0;
    this.state.paused = true;
  }

  /** V1.1.0：关闭暂停菜单 */
  private closePauseMenu(): void {
    if (!this.ui) return;
    this.ui.pauseMenuOpen = false;
    this.state.paused = this.pausedBeforeMenu || isTutorialActive();
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

  private feedback<T>(result: ActionResult<T>, sound: () => void): void {
    if (result.ok === true) sound();
    else this.state.alert = { text: result.reason, until: this.state.elapsedSeconds + 3 };
  }

  private connect(from: string, to: string): void {
    this.feedback(
      connectNodes(this.state, from, to, this.state.selectedEdgeType, this.techState),
      sfxConnect,
    );
  }

  private placeNode(x: number, y: number): void {
    if (!this.buildMode) return;
    const result = buildNode(this.state, this.buildMode, x, y, this.techState);
    this.feedback(result, sfxBuild);
    if (result.ok) { this.buildMode = null; this.state.selectedNodeId=result.value.id; }
  }

  getBuildPlacementStatus(): PlacementStatus | null {
    if (this.state.gameOver || this.state.levelWon || this.ui?.hasOpenSubPanel() || this.ui?.pauseMenuOpen || this.pointerHitsHud(this.pointerX, this.pointerY)) return null;
    return this.buildMode
      ? placementStatus(
          this.state,
          this.buildMode,
          this.state.mouseX,
          this.state.mouseY,
          this.techState,
        )
      : null;
  }

  private pointerHitsHud(x: number, y: number): boolean {
    if (y < 72 || y > this.state.canvasHeight - 128) return true;
    const map = minimapRect(this.state.canvasWidth, this.state.canvasHeight, this.state.worldWidth, this.state.worldHeight);
    return [map, ...(this.ui?.hudRects ?? [])].some(rect => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    // V1.2.4：科技树打开时滚轮翻页，不操作镜头
    if (this.techState.showPanel && this.ui) {
      this.ui.scrollTechPanel(e.deltaY);
      return;
    }
    // V1.5.11：知识库面板打开时滚轮翻页
    if (this.ui && this.ui.showKnowledgePanel) {
      this.ui.scrollKnowledgePanel(e.deltaY);
      return;
    }
    // V1.6.1：成就面板打开时滚轮翻页
    if (this.ui && this.ui.showAchievementPanel) {
      this.ui.scrollAchievementPanel(e.deltaY);
      return;
    }
    if (this.ui?.showSynergyPanel) {
      this.ui.scrollSynergyPanel(e.deltaY);
      return;
    }
    if (this.ui?.hasOpenSubPanel() || this.ui?.pauseMenuOpen) return;
    const cam = this.state.camera;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = this.canvas.getBoundingClientRect(),
      sx = e.clientX - rect.left,
      sy = e.clientY - rect.top;
    this.pointerX = sx;
    this.pointerY = sy;
    const wx = cam.targetX + sx / cam.targetZoom,
      wy = cam.targetY + sy / cam.targetZoom;
    cam.targetZoom = Math.max(0.3, Math.min(2.0, cam.targetZoom * zoomFactor));
    cam.targetX = wx - sx / cam.targetZoom;
    cam.targetY = wy - sy / cam.targetZoom;
    this.clampCamera();
  }

  private clampCamera(): void {
    const cam = this.state.camera;
    const viewW = this.state.canvasWidth / cam.targetZoom;
    const centerY = (this.state.canvasHeight+72-128)/cam.targetZoom/2;
    // 约束观察中心，允许边缘设施进入可操作区域中央。
    cam.targetX=Math.max(0,Math.min(this.state.worldWidth,cam.targetX+viewW/2))-viewW/2;
    cam.targetY=Math.max(0,Math.min(this.state.worldHeight,cam.targetY+centerY))-centerY;
  }

  private upgradeNode(nodeId: string): void {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (node) this.feedback(upgradeBuilding(this.state, node, this.techState), sfxBuild);
  }

  private sellNode(nodeId: string): void {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (node) this.feedback(recycleBuilding(this.state, node), sfxSell);
  }

  /** 招募中立节点 */
  private recruitNode(nodeId: string): void {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (node) this.feedback(recruitBuilding(this.state, node, this.techState), sfxBuild);
  }

  /** 核心扩展卡 — 扩大领地范围 */
  private expandCore(nodeId: string): void {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== 'core' || node.expanded || node.owner!=='player' || node.status==='destroyed' || !node.connected || this.state.gameOver || this.state.levelWon) return;
    if (this.state.resources < EXPAND_COST || this.state.crystals < EXPAND_CRYSTAL_COST) return;
    this.state.resources -= EXPAND_COST;
    this.state.resourcesSpent += EXPAND_COST;
    node.investment += EXPAND_COST;
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
