import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setKey, getKey } from '../src/keybinds';

test('reserved navigation and manual keys cannot replace an action binding', () => {
  const before = getKey('pause');
  for (const key of ['h', 'k', 'escape', 'enter', 'tab', ' ', 'backspace', 'control', '1'])
    assert.equal(setKey('pause', key), false, key);
  assert.equal(getKey('pause'), before);
});
