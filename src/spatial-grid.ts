// V1.2.6：均匀网格空间索引（用于敌人查询）
// 用法：每个 tick 在 processNodeEffects 入口 build 一次，所有 fireXxx / radarLockDamage / blackholeGravity
// 等需要按范围筛选敌人的函数改用 grid.query(x, y, range)，把 O(N) 距离判定降为 O(k) k=邻近格内敌人数。
//
// 设计取舍：
// - cellSize=160：略大于常见塔的 baseRange(120-200)，让单次查询通常只命中 4 格，避免桶过细带来的 cell 数膨胀
// - Map<number, Enemy[]>：稀疏存储，世界 3000×2000 / 160 = 19×13=247 格，但活跃敌人通常聚集在一小块，Map 更省内存
// - query 返回新数组：调用方可以安全地嵌套查询（如 sniper 主目标 → 击杀溅射），不必担心共享 buffer 被覆盖
//   alloc 成本相比节省的 95% 距离平方运算可忽略

import type { Enemy } from './types';

const KEY_MULT = 100000; // |cy| 必须 < 50000，对世界尺寸足够

export class EnemyGrid {
  readonly cellSize: number;
  private cells: Map<number, Enemy[]> = new Map();

  constructor(cellSize = 160) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): number {
    // 支持负坐标：把 cy 平移到正区间
    return cx * KEY_MULT + (cy + KEY_MULT / 2);
  }

  build(enemies: Enemy[]): void {
    this.cells.clear();
    const cs = this.cellSize;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const cx = Math.floor(e.x / cs);
      const cy = Math.floor(e.y / cs);
      const k = this.key(cx, cy);
      let bucket = this.cells.get(k);
      if (!bucket) {
        bucket = [];
        this.cells.set(k, bucket);
      }
      bucket.push(e);
    }
  }

  /** 返回与 (x,y) 圆形范围相交的网格内所有敌人（包含范围外少量邻格内容，调用方仍需精确 dist 判定） */
  query(x: number, y: number, range: number): Enemy[] {
    const cs = this.cellSize;
    const minCx = Math.floor((x - range) / cs);
    const maxCx = Math.floor((x + range) / cs);
    const minCy = Math.floor((y - range) / cs);
    const maxCy = Math.floor((y + range) / cs);
    const out: Enemy[] = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) {
          for (const e of bucket) out.push(e);
        }
      }
    }
    return out;
  }
}
