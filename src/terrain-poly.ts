// V1.3.0 多边形地形几何 helper
import type { GameState, TerrainPolygon, TerrainType } from './types';

export interface PolygonInput {
  id?: string;
  type: TerrainType;
  vertices: { x: number; y: number }[] | [number, number][];
  slowFactor?: number;
  linkedId?: string;
}

let _polyIdSeq = 0;
function nextPolyId(): string {
  return `tpoly_${Date.now().toString(36)}_${(_polyIdSeq++).toString(36)}`;
}

/** 把简化输入（包含 [x,y] 元组写法）规范化成完整 TerrainPolygon */
export function buildTerrainPolygon(input: PolygonInput): TerrainPolygon {
  const verts = (input.vertices as Array<any>).map(v =>
    Array.isArray(v) ? { x: v[0], y: v[1] } : { x: v.x, y: v.y },
  );
  if (verts.length < 3) {
    throw new Error('TerrainPolygon vertices < 3');
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  // 几何中心：用顶点平均（足够；面积加权后续若需要再换）
  let cx = 0, cy = 0;
  for (const v of verts) { cx += v.x; cy += v.y; }
  cx /= verts.length; cy /= verts.length;
  return {
    id: input.id ?? nextPolyId(),
    type: input.type,
    vertices: verts,
    bbox: { minX, minY, maxX, maxY },
    centroid: { x: cx, y: cy },
    slowFactor: input.slowFactor,
    linkedId: input.linkedId,
  };
}

/** 点-多边形测试（射线法），先 bbox 早退 */
export function pointInPolygon(px: number, py: number, poly: TerrainPolygon): boolean {
  const b = poly.bbox;
  if (px < b.minX || px > b.maxX || py < b.minY || py > b.maxY) return false;
  const v = poly.vertices;
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const xi = v[i].x, yi = v[i].y;
    const xj = v[j].x, yj = v[j].y;
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 检查 (x,y) 是否落在 asteroid 多边形内（建造禁区） */
export function isPointInAsteroidPolygon(state: GameState, x: number, y: number): boolean {
  for (const poly of state.terrainPolygons) {
    if (poly.type !== 'asteroid') continue;
    if (pointInPolygon(x, y, poly)) return true;
  }
  return false;
}

/** 在 (x,y) 处采样所有星云多边形的最小减速倍率（无星云时返回 1） */
export function getNebulaPolygonSlowFactor(state: GameState, x: number, y: number): number {
  let factor = 1;
  for (const poly of state.terrainPolygons) {
    if (poly.type !== 'nebula') continue;
    if (pointInPolygon(x, y, poly)) {
      const f = poly.slowFactor ?? 0.5;
      if (f < factor) factor = f;
    }
  }
  return factor;
}

/** 两条线段是否相交（标准方向法） */
function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return false; // 平行/共线，简化按不相交
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** 线段 (a→b) 是否与多边形相交（任一边相交，或两端都在多边形内） */
export function lineIntersectsPolygon(
  ax: number, ay: number, bx: number, by: number,
  poly: TerrainPolygon,
): boolean {
  const b = poly.bbox;
  // bbox 早退：线段两端都在某一侧外
  if ((ax < b.minX && bx < b.minX) || (ax > b.maxX && bx > b.maxX)
    || (ay < b.minY && by < b.minY) || (ay > b.maxY && by > b.maxY)) return false;
  const v = poly.vertices;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    if (segmentsIntersect(ax, ay, bx, by, v[j].x, v[j].y, v[i].x, v[i].y)) return true;
  }
  // 边都不相交，但两端可能都在内部
  return pointInPolygon(ax, ay, poly);
}

/** 检查线段是否被任何 asteroid 多边形阻挡 */
export function lineBlockedByAsteroidPolygon(
  state: GameState, ax: number, ay: number, bx: number, by: number,
): boolean {
  for (const poly of state.terrainPolygons) {
    if (poly.type !== 'asteroid') continue;
    if (lineIntersectsPolygon(ax, ay, bx, by, poly)) return true;
  }
  return false;
}
