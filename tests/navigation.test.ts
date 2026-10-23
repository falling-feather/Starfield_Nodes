import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPath, isSegmentWalkable, displaceEnemy } from '../src/navigation';
import { buildTerrainPolygon } from '../src/terrain-poly';
import { state, enemy } from './fixtures';

test('a route goes around an asteroid and every segment stays traversable', () => {
  const s = state();
  s.terrainPolygons = [
    buildTerrainPolygon({
      type: 'asteroid',
      vertices: [
        [400, 300],
        [600, 300],
        [600, 700],
        [400, 700],
      ],
    }),
  ];
  const start = { x: 200, y: 500 },
    goal = { x: 800, y: 500 };
  assert.equal(isSegmentWalkable(s, start, goal), false);
  const route = findPath(s, start, goal);
  assert.ok(route && route.length > 1);
  let from = start;
  for (const to of route) {
    assert.equal(isSegmentWalkable(s, from, to), true);
    from = to;
  }
  assert.deepEqual(route.at(-1), goal);
});

test('gravity and magnetic displacement cannot pull a unit through solid terrain', () => {
  const s = state();
  s.terrainPolygons = [
    buildTerrainPolygon({
      type: 'asteroid',
      vertices: [
        [400, 300],
        [600, 300],
        [600, 700],
        [400, 700],
      ],
    }),
  ];
  const e = enemy('heavy', 200, 500);
  assert.equal(displaceEnemy(s, e, 500, 0), false);
  assert.equal(e.x, 200);
  assert.equal(displaceEnemy(s, e, 50, 0), true);
  assert.equal(e.x, 250);
});
