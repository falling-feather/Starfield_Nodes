import type { Enemy } from './types';

/** All player weapons share the same shield-aura damage rule. */
export function damageEnemy(enemy: Enemy, amount: number): void {
  if (enemy.hp <= 0) return;
  enemy.hp -= Math.max(0, amount) * (1 - Math.min(0.8, Math.max(0, enemy.damageReduction)));
}
