import { setSeed } from '../src/rng';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../src/data/balance';
import { NODE_CONFIGS } from '../src/data/nodes';
import { ENEMY_COLORS } from '../src/data/enemies';
import {
  createEdge,
  distributeEnergy,
  updateConnectedStatus,
  updateOvercharge,
  processNodeEffects,
} from '../src/graph';
import { processEnemySupport, updateEnemies } from '../src/entities';
import { updateParticles } from '../src/particles';
import { updateVisibility } from '../src/visibility';
import { upgradeNode } from '../src/construction';
import { createTechState } from '../src/tech';
import type { NodeType, EnemyType } from '../src/types';
import { state, node, enemy } from './fixtures';

test('all node families and evolved effects keep combat values finite and energy within documented overcharge bounds', () => {
  setSeed(20261018);
  const s = state(),
    tech = createTechState();
  s.resources = 1e6;
  s.crystals = 1e6;
  const types = Object.keys(NODE_CONFIGS) as NodeType[];
  s.nodes = types.map((type, i) => node(type, 350 + (i % 6) * 130, 260 + Math.floor(i / 6) * 130));
  for (let i = 1; i < s.nodes.length; i++) {
    const parent = i % 6 ? s.nodes[i - 1] : s.nodes[i - 6];
    s.edges.push(createEdge(parent.id, s.nodes[i].id));
  }
  updateConnectedStatus(s);
  updateVisibility(s);
  s.nodes.forEach((n, i) => {
    if (i % 2)
      while (upgradeNode(s, n, tech).ok) {
        /* Exercise the actual upgrade path. */
      }
    n.currentEnergy = n.maxEnergy;
  });
  s.enemies = (Object.keys(ENEMY_COLORS) as EnemyType[]).map((type, i) => {
    const e = enemy(type, 530 + (i % 3) * 55, 340 + Math.floor(i / 3) * 60);
    e.hp = 3000;
    e.maxHp = 3000;
    return e;
  });
  for (let frame = 1; frame <= 360; frame++) {
    s.elapsedSeconds = frame / 60;
    if (frame % 30 === 0) {
      s.tick++;
      distributeEnergy(s);
      updateConnectedStatus(s);
      updateVisibility(s);
      processEnemySupport(s);
      updateOvercharge(s);
      processNodeEffects(s);
    }
    updateEnemies(s, 1 / 60);
    updateParticles(s, 1 / 60);
    for (const n of s.nodes) {
      assert.ok(Number.isFinite(n.currentEnergy) && Number.isFinite(n.hp), n.type);
      assert.ok(
        n.currentEnergy >= -1e-8 &&
          n.currentEnergy <=
            n.maxEnergy *
              Math.max(
                1,
                COMBAT.bufferPulse.overchargeCapRatio,
                COMBAT.energy.ocBroadcastCapRatio,
              ) +
              1e-8,
        `${n.type}: invalid energy ${n.currentEnergy}`,
      );
    }
    for (const e of s.enemies)
      assert.ok([e.x, e.y, e.hp, e.speed, e.damageReduction].every(Number.isFinite), e.type);
  }
});
