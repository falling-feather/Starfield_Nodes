import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS } from '../src/achievements';
import type { AchievementContext } from '../src/achievements';
import { LEVELS } from '../src/levels';

test('complete campaign achievement requires each actual route, rather than six or repeated IDs', () => {
  const achievement = ACHIEVEMENTS.find((a) => a.id === 'clear_all')!;
  const context = { clearedLevels: LEVELS.slice(0, 6).map((l) => l.id) } as AchievementContext;
  assert.equal(achievement.check(context), false);
  context.clearedLevels = Array(LEVELS.length).fill(1);
  assert.equal(achievement.check(context), false);
  context.clearedLevels = LEVELS.map((l) => l.id);
  assert.equal(achievement.check(context), true);
});
