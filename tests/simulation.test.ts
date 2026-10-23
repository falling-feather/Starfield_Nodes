import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationClock } from '../src/simulation-clock';
import { updateEnemies, processEnemySupport } from '../src/entities';
import { state, enemy } from './fixtures';

test('one second of simulation is identical at 30/60/144 render fps', () => {
  const counts = [30, 60, 144].map((fps) => {
    const clock = new SimulationClock();
    let steps = 0;
    for (let i = 0; i < fps; i++)
      clock.advance(1 / fps, 1, () => {
        steps++;
      });
    return steps;
  });
  assert.deepEqual(counts, [60, 60, 60]);
});

test('3x advances exactly the same simulation as three real seconds at 1x', () => {
  let normal = 0,
    accelerated = 0;
  const a = new SimulationClock(),
    b = new SimulationClock();
  for (let i = 0; i < 180; i++)
    a.advance(1 / 60, 1, () => {
      normal++;
    });
  for (let i = 0; i < 60; i++)
    b.advance(1 / 60, 3, () => {
      accelerated++;
    });
  assert.equal(normal, 180);
  assert.equal(accelerated, normal);
});

test('healing is settled once by a simulation tick, never by render updates', () => {
  const s = state();
  s.tick = 60;
  const healer = enemy('healer', 100, 100),
    target = enemy('scout', 110, 100);
  target.hp = 10;
  s.enemies = [healer, target];
  for (let i = 0; i < 10; i++) updateEnemies(s, 1 / 60);
  assert.equal(target.hp, 10);
  processEnemySupport(s);
  assert.equal(target.hp, 19.5);
});
