// V1.3.2 dev-only 多边形地形编辑器
// V1.3.3 新增：Ctrl+L 载入现有 state.terrainPolygons，左键拖动顶点修改，右键删除顶点
// 用法：
//   Ctrl+E 切换编辑模式
//   Ctrl+L 把当前关 state.terrainPolygons 载入为草稿（替换现有草稿）
//   N / A / W   切换当前类型（nebula / asteroid / wormhole）
//   左键   在世界坐标添加顶点；若按下时命中已闭合草稿/进行中的某个顶点 → 进入拖动
//   右键   命中顶点 → 删除该顶点（多边形顶点 ≤ 3 时整块删除）
//   Enter  闭合当前多边形（≥ 3 顶点）→ 加入草稿列表
//   Backspace  撤销最后一个顶点
//   Esc    清空当前进行中顶点（不影响已闭合的多边形）
//   Ctrl+S 把草稿列表 console.log 为可粘贴的 JSON
//   Ctrl+D 清空全部草稿（含已闭合的）
import type { TerrainType, GameState } from './types';

export interface DraftPolygon {
  type: TerrainType;
  vertices: [number, number][];
  slowFactor?: number;
  linkedId?: string;
  id?: string;
}

/** 拖动目标：draftIdx = -1 表示在 pendingVertices 中 */
export interface DragTarget {
  draftIdx: number;
  vertexIdx: number;
}

export class PolygonEditor {
  active = false;
  currentType: TerrainType = 'nebula';
  /** 当前正在绘制的多边形顶点（世界坐标） */
  pendingVertices: [number, number][] = [];
  /** 已闭合的草稿多边形 */
  drafts: DraftPolygon[] = [];
  /** V1.3.3 当前正在拖动的顶点 */
  dragTarget: DragTarget | null = null;

  toggle(): void {
    this.active = !this.active;
    if (!this.active) {
      this.pendingVertices = [];
      this.dragTarget = null;
    }
  }

  setType(t: TerrainType): void {
    if (!this.active) return;
    this.currentType = t;
  }

  addVertex(wx: number, wy: number): void {
    if (!this.active) return;
    this.pendingVertices.push([Math.round(wx), Math.round(wy)]);
  }

  undoVertex(): void {
    if (!this.active) return;
    this.pendingVertices.pop();
  }

  cancelPending(): void {
    if (!this.active) return;
    this.pendingVertices = [];
  }

  closeCurrent(): void {
    if (!this.active) return;
    if (this.pendingVertices.length < 3) return;
    this.drafts.push({
      type: this.currentType,
      vertices: this.pendingVertices.slice(),
    });
    this.pendingVertices = [];
  }

  clearAll(): void {
    if (!this.active) return;
    this.drafts = [];
    this.pendingVertices = [];
    this.dragTarget = null;
  }

  /** V1.3.3 把游戏当前的 terrainPolygons 载入为草稿（替换现有草稿） */
  loadFromState(state: GameState): void {
    if (!this.active) return;
    this.drafts = state.terrainPolygons.map(p => ({
      type: p.type,
      vertices: p.vertices.map(v => [Math.round(v.x), Math.round(v.y)] as [number, number]),
      slowFactor: p.slowFactor,
      linkedId: p.linkedId,
      id: p.id,
    }));
    this.pendingVertices = [];
    this.dragTarget = null;
  }

  /** V1.3.3 在世界坐标 (wx,wy) 半径 hitR 内查找最近的顶点；优先 pending，再 drafts */
  findVertexAt(wx: number, wy: number, hitR: number): DragTarget | null {
    let best: { target: DragTarget; d2: number } | null = null;
    const r2 = hitR * hitR;
    for (let i = 0; i < this.pendingVertices.length; i++) {
      const [x, y] = this.pendingVertices[i];
      const d2 = (x - wx) * (x - wx) + (y - wy) * (y - wy);
      if (d2 <= r2 && (!best || d2 < best.d2)) {
        best = { target: { draftIdx: -1, vertexIdx: i }, d2 };
      }
    }
    for (let di = 0; di < this.drafts.length; di++) {
      const verts = this.drafts[di].vertices;
      for (let vi = 0; vi < verts.length; vi++) {
        const [x, y] = verts[vi];
        const d2 = (x - wx) * (x - wx) + (y - wy) * (y - wy);
        if (d2 <= r2 && (!best || d2 < best.d2)) {
          best = { target: { draftIdx: di, vertexIdx: vi }, d2 };
        }
      }
    }
    return best ? best.target : null;
  }

  startDrag(target: DragTarget): void {
    if (!this.active) return;
    this.dragTarget = target;
  }

  updateDrag(wx: number, wy: number): void {
    if (!this.active || !this.dragTarget) return;
    const { draftIdx, vertexIdx } = this.dragTarget;
    const arr = draftIdx === -1 ? this.pendingVertices : this.drafts[draftIdx]?.vertices;
    if (!arr || vertexIdx >= arr.length) { this.dragTarget = null; return; }
    arr[vertexIdx] = [Math.round(wx), Math.round(wy)];
  }

  endDrag(): void {
    this.dragTarget = null;
  }

  /** V1.3.3 删除某个顶点；草稿顶点 ≤ 3 时整块删除 */
  deleteVertexAt(wx: number, wy: number, hitR: number): boolean {
    if (!this.active) return false;
    const target = this.findVertexAt(wx, wy, hitR);
    if (!target) return false;
    if (target.draftIdx === -1) {
      this.pendingVertices.splice(target.vertexIdx, 1);
    } else {
      const draft = this.drafts[target.draftIdx];
      if (draft.vertices.length <= 3) {
        this.drafts.splice(target.draftIdx, 1);
      } else {
        draft.vertices.splice(target.vertexIdx, 1);
      }
    }
    return true;
  }

  exportJSON(): string {
    // 输出可直接粘到 LevelConfig.terrainPolygons 的 JSON 片段
    const json = this.drafts.map(p => {
      const obj: Record<string, unknown> = { type: p.type, vertices: p.vertices };
      if (p.slowFactor !== undefined) obj.slowFactor = p.slowFactor;
      if (p.linkedId) obj.linkedId = p.linkedId;
      if (p.id) obj.id = p.id;
      return obj;
    });
    return JSON.stringify(json, null, 2);
  }
}
