import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, recommendedLoadout, getUnlockedLevels } from '../src/levels';
import { initializeMap, updateConnectedStatus } from '../src/graph';
import { isPointWalkable, findPath } from '../src/navigation';
import { setSeed } from '../src/rng';
import { updateVisibility, isPositionVisible } from '../src/visibility';
import { state } from './fixtures';

for (const level of LEVELS)
  test(`mission ${level.id}: valid starts, entry routes and initial information`, () => {
    const s = state();
    s.worldWidth = level.worldWidth;
    s.worldHeight = level.worldHeight;
    s.mission = level.tactics;
    const loadout = recommendedLoadout(level);
    assert.ok(loadout.length > 0 && loadout.length <= level.maxSelectedNodes);
    assert.ok(loadout.every((type) => level.availableNodes.includes(type)));
    setSeed(318 + level.id);
    initializeMap(s, level);
    updateConnectedStatus(s);
    updateVisibility(s);
    const cores = s.nodes.filter((n) => n.type === 'core');
    assert.equal(cores.length, level.corePositions?.length ?? 1);
    for (const core of cores) assert.equal(isPositionVisible(s, core.x, core.y), true);
    for (const n of s.nodes) assert.ok(isPointWalkable(s, n.x, n.y), `blocked node ${n.type}`);
    for (const e of s.edges) {
      assert.ok(s.nodes.some((n) => n.id === e.sourceId));
      assert.ok(s.nodes.some((n) => n.id === e.targetId));
    }
    for (const entry of level.tactics!.entryPoints) {
      const point = { x: entry.x * s.worldWidth, y: entry.y * s.worldHeight };
      assert.ok(isPointWalkable(s, point.x, point.y), `blocked entry ${entry.label}`);
      assert.ok(findPath(s, point, cores[0]), `unreachable entry ${entry.label}`);
      assert.equal(
        isPositionVisible(s, point.x, point.y),
        false,
        'frontier starts outside sensor range',
      );
    }
  });

test('a freely completed route remains replayable even when its earlier prerequisite was skipped', () => {
  const unlocked = getUnlockedLevels([7]).map((level) => level.id);
  assert.ok(unlocked.includes(7) && unlocked.includes(8));
  assert.equal(unlocked.includes(6), false);
});
