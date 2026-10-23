import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateEnemies } from '../src/entities';
import { damageEnemy } from '../src/enemy-health';
import { ENEMY_DEATH_REWARDS } from '../src/data/balance';
import { state, node, enemy } from './fixtures';

test('an enemy killed by an instant weapon cannot attack before cleanup', () => {
  const s = state(),
    core = node('core', 500, 500),
    target = enemy('scout', 500, 500);
  s.nodes = [core];
  s.enemies = [target];
  const hp = core.hp;
  damageEnemy(target, target.hp);
  updateEnemies(s, 1 / 60);
  assert.equal(core.hp, hp);
  assert.equal(s.enemiesKilled, 1);
  assert.equal(s.score, ENEMY_DEATH_REWARDS.scout!.score);
  assert.equal(s.resources, 200 + ENEMY_DEATH_REWARDS.scout!.res);
});

test('simultaneous projectiles award a death once and match instant weapon rewards', () => {
  const s = state(),
    target = enemy('heavy', 500, 500);
  target.hp = 1;
  s.enemies = [target];
  const resources = s.resources;
  s.projectiles = [1, 2].map(() => ({
    x: 500,
    y: 500,
    targetId: target.id,
    speed: 8,
    damage: 50,
    color: '#fff',
  }));
  updateEnemies(s, 1 / 60);
  updateEnemies(s, 1 / 60);
  const reward = ENEMY_DEATH_REWARDS.heavy!;
  assert.equal(s.score, reward.score);
  assert.equal(s.resources, resources + reward.res);
  assert.equal(s.crystals, reward.crystal);
  assert.equal(s.enemiesKilled, 1);
  assert.equal(s.enemies.length, 0);
  assert.equal(s.projectiles.length, 0);
});
