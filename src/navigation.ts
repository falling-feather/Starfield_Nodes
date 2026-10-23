import type { GameState, Enemy, Point } from './types';
import { pointInPolygon, lineIntersectsPolygon } from './terrain-poly';

const CELL = 64;
const grids = new WeakMap<GameState, NavigationGrid>();
const routes = new WeakMap<
  Enemy,
  { targetX: number; targetY: number; points: Point[]; index: number }
>();

export function isPointWalkable(state: GameState, x: number, y: number): boolean {
  return (
    x >= 12 &&
    y >= 12 &&
    x <= state.worldWidth - 12 &&
    y <= state.worldHeight - 12 &&
    !state.terrainPolygons.some((p) => p.type === 'asteroid' && pointInPolygon(x, y, p)) &&
    !state.terrainZones.some(
      (p) => p.type === 'asteroid' && Math.hypot(x - p.x, y - p.y) < p.radius + 6,
    )
  );
}

export function isSegmentWalkable(state: GameState, a: Point, b: Point): boolean {
  if (!isPointWalkable(state, a.x, a.y) || !isPointWalkable(state, b.x, b.y)) return false;
  if (
    state.terrainPolygons.some(
      (p) => p.type === 'asteroid' && lineIntersectsPolygon(a.x, a.y, b.x, b.y, p),
    )
  )
    return false;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    lengthSq = dx * dx + dy * dy;
  return !state.terrainZones.some((p) => {
    if (p.type !== 'asteroid') return false;
    const t = lengthSq
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
      : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < p.radius + 6;
  });
}

class NavigationGrid {
  private state: GameState;
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  constructor(state: GameState) {
    this.state = state;
    this.cols = Math.ceil(state.worldWidth / CELL);
    this.rows = Math.ceil(state.worldHeight / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let i = 0; i < this.blocked.length; i++) {
      const p = this.point(i);
      this.blocked[i] = isPointWalkable(state, p.x, p.y) ? 0 : 1;
    }
  }
  point(index: number): Point {
    return {
      x: Math.min(this.state.worldWidth - 16, ((index % this.cols) + 0.5) * CELL),
      y: Math.min(this.state.worldHeight - 16, (Math.floor(index / this.cols) + 0.5) * CELL),
    };
  }
  nearest(p: Point): number {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / CELL)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / CELL)));
    for (let r = 0; r <= 8; r++)
      for (let y = Math.max(0, cy - r); y <= Math.min(this.rows - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(this.cols - 1, cx + r); x++) {
          const index = y * this.cols + x;
          if (!this.blocked[index] && isSegmentWalkable(this.state, p, this.point(index)))
            return index;
        }
      }
    return -1;
  }
  path(start: Point, goal: Point): Point[] | null {
    const from = this.nearest(start),
      to = this.nearest(goal);
    if (from < 0 || to < 0) return null;
    const cost = new Float64Array(this.blocked.length).fill(Infinity);
    const parent = new Int32Array(this.blocked.length).fill(-1);
    const closed = new Uint8Array(this.blocked.length);
    const open: { index: number; score: number }[] = [];
    const heuristic = (i: number) =>
      Math.hypot(
        (i % this.cols) - (to % this.cols),
        Math.floor(i / this.cols) - Math.floor(to / this.cols),
      );
    const push = (entry: { index: number; score: number }) => {
      open.push(entry);
      let i = open.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (open[p].score <= entry.score) break;
        open[i] = open[p];
        i = p;
      }
      open[i] = entry;
    };
    const pop = () => {
      const first = open[0],
        last = open.pop()!;
      if (open.length) {
        let i = 0;
        while (i * 2 + 1 < open.length) {
          let child = i * 2 + 1;
          if (child + 1 < open.length && open[child + 1].score < open[child].score) child++;
          if (open[child].score >= last.score) break;
          open[i] = open[child];
          i = child;
        }
        open[i] = last;
      }
      return first.index;
    };
    cost[from] = 0;
    push({ index: from, score: heuristic(from) });
    while (open.length) {
      const current = pop();
      if (closed[current]) continue;
      if (current === to) {
        const raw: Point[] = [goal];
        for (let i = to; i !== from && i >= 0; i = parent[i]) raw.push(this.point(i));
        raw.push(start);
        raw.reverse();
        const smoothed: Point[] = [];
        let anchor = 0;
        while (anchor < raw.length - 1) {
          let next = raw.length - 1;
          while (next > anchor + 1 && !isSegmentWalkable(this.state, raw[anchor], raw[next]))
            next--;
          smoothed.push(raw[next]);
          anchor = next;
        }
        return smoothed;
      }
      closed[current] = 1;
      const cx = current % this.cols,
        cy = Math.floor(current / this.cols);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (
            (!dx && !dy) ||
            cx + dx < 0 ||
            cx + dx >= this.cols ||
            cy + dy < 0 ||
            cy + dy >= this.rows
          )
            continue;
          const next = (cy + dy) * this.cols + cx + dx;
          if (
            closed[next] ||
            this.blocked[next] ||
            !isSegmentWalkable(this.state, this.point(current), this.point(next))
          )
            continue;
          const candidate = cost[current] + Math.hypot(dx, dy);
          if (candidate >= cost[next]) continue;
          cost[next] = candidate;
          parent[next] = current;
          push({ index: next, score: candidate + heuristic(next) });
        }
    }
    return null;
  }
}

export function resetNavigation(state: GameState): void {
  grids.delete(state);
}
export function invalidateEnemyRoute(enemy: Enemy): void {
  routes.delete(enemy);
}

export function displaceEnemy(state: GameState, enemy: Enemy, dx: number, dy: number): boolean {
  const target = { x: enemy.x + dx, y: enemy.y + dy };
  if (!isSegmentWalkable(state, enemy, target)) return false;
  enemy.x = target.x;
  enemy.y = target.y;
  invalidateEnemyRoute(enemy);
  return true;
}

export function findPath(state: GameState, start: Point, goal: Point): Point[] | null {
  if (isSegmentWalkable(state, start, goal)) return [{ ...goal }];
  let grid = grids.get(state);
  if (!grid) {
    grid = new NavigationGrid(state);
    grids.set(state, grid);
  }
  return grid.path(start, goal);
}

export function moveEnemy(state: GameState, enemy: Enemy, target: Point, distance: number): void {
  let route = routes.get(enemy);
  if (!route || route.targetX !== target.x || route.targetY !== target.y) {
    route = {
      targetX: target.x,
      targetY: target.y,
      points: findPath(state, enemy, target) ?? [],
      index: 0,
    };
    routes.set(enemy, route);
  }
  const point = route.points[route.index];
  if (!point) return;
  const dx = point.x - enemy.x,
    dy = point.y - enemy.y,
    length = Math.hypot(dx, dy);
  if (length <= distance + 0.5) {
    enemy.x = point.x;
    enemy.y = point.y;
    route.index++;
  } else {
    enemy.x += (dx / length) * distance;
    enemy.y += (dy / length) * distance;
  }
}

export function enemyRoute(enemy: Enemy): readonly Point[] {
  const route = routes.get(enemy);
  return route ? route.points.slice(route.index) : [];
}
