import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game';
import { LEVELS } from '../src/levels';
import type { GameState } from '../src/types';

test('initial and restarted sessions use the assigned mission funds and crystals', () => {
  const previous = globalThis.window;
  Object.assign(globalThis, { window: { innerWidth: 1440, innerHeight: 900 } });
  try {
    // Exercise the same session factory used by the constructor and quick restart.
    const factory = Reflect.get(Game.prototype, 'createInitialState');
    for (const level of LEVELS) {
      const owner = { levelConfig: level, profile: { discoveredSynergies: [] } };
      const first: GameState = Reflect.apply(factory, owner, []);
      assert.equal(first.resources, level.startResources, level.name);
      assert.equal(first.crystals, level.startCrystals ?? 0, level.name);
      first.resources = 9999;
      first.crystals = 9999;
      first.elapsedSeconds = 40;
      const next: GameState = Reflect.apply(factory, owner, []);
      assert.equal(next.resources, level.startResources, level.name);
      assert.equal(next.crystals, level.startCrystals ?? 0, level.name);
      assert.equal(next.elapsedSeconds, 0);
      assert.equal(next.score, 0);
    }
  } finally {
    Object.assign(globalThis, { window: previous });
  }
});
