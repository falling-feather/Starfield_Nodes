import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/input';
import { UI } from '../src/ui';
import { createTechState } from '../src/tech';
import { updateVisibility } from '../src/visibility';
import { state, node } from './fixtures';
import { minimapRect } from '../src/canvas-ui';

class CanvasTarget extends EventTarget {
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1280, height: 800 };
  }
}
function emit(target: EventTarget, type: string, properties: Record<string, unknown>): void {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
}
function setup() {
  const previous = globalThis.window,
    keyboard = new EventTarget();
  Object.assign(globalThis, { window: keyboard });
  const s = state(),
    tech = createTechState(),
    ui = new UI({} as CanvasRenderingContext2D),
    canvas = new CanvasTarget();
  ui.techState = tech;
  let retries = 0;
  const input = new InputManager(
    canvas as unknown as HTMLCanvasElement,
    s,
    () => {
      retries++;
    },
    tech,
    ui,
  );
  return {
    s,
    tech,
    ui,
    canvas,
    input,
    keyboard,
    retries: () => retries,
    close: () => {
      input.destroy();
      Object.assign(globalThis, { window: previous });
    },
  };
}

test('construction previews and drag releases cannot target buildings covered by the HUD', () => {
  const f = setup();
  try {
    const core = node('core', 500, 400), target = node('relay', 620, 400);
    f.s.nodes = [core, target];
    updateVisibility(f.s);
    f.ui.hudRects = [{ x: 590, y: 320, w: 180, h: 180 }];
    emit(f.keyboard, 'keydown', { key: '1', ctrlKey: false, shiftKey: false, repeat: false });
    emit(f.canvas, 'mousemove', { clientX: 400, clientY: 20 });
    assert.equal(f.input.getBuildPlacementStatus(), null);
    emit(f.canvas, 'mousemove', { clientX: 700, clientY: 430 });
    assert.equal(f.input.getBuildPlacementStatus(), null);
    emit(f.canvas, 'mousemove', { clientX: 800, clientY: 500 });
    assert.notEqual(f.input.getBuildPlacementStatus(), null);
    emit(f.keyboard, 'keydown', { key: 'Escape', ctrlKey: false, shiftKey: false, repeat: false });
    const funds = f.s.resources;
    emit(f.canvas, 'mousedown', { button: 0, clientX: 500, clientY: 400, ctrlKey: false, shiftKey: false });
    emit(f.canvas, 'mousemove', { clientX: 620, clientY: 400 });
    emit(f.canvas, 'mouseup', { button: 0, clientX: 620, clientY: 400 });
    assert.equal(f.s.edges.length, 0);
    assert.equal(f.s.resources, funds);
    f.s.selectedNodeId = core.id;
    f.ui.nodeButtons = [{ action: 'connect', x: 900, y: 300, w: 100, h: 40, enabled: true }];
    emit(f.canvas, 'mousedown', { button: 0, clientX: 950, clientY: 320, ctrlKey: false, shiftKey: false });
    emit(f.canvas, 'mouseup', { button: 0, clientX: 950, clientY: 320 });
    assert.equal(f.s.draggingFrom, core.id, 'clicking the inspector keeps click-to-connect mode active');
  } finally { f.close(); }
});

test('keyboard pause, modal research and retry preserve their actual input behavior', () => {
  const f = setup();
  try {
    const key = (key: string, repeat = false) =>
      emit(f.keyboard, 'keydown', { key, ctrlKey: false, shiftKey: false, repeat });
    key('p');
    assert.equal(f.s.paused, true);
    key('p', true);
    assert.equal(f.s.paused, true);
    key('t');
    assert.equal(f.tech.showPanel, true);
    key('Escape');
    assert.equal(f.tech.showPanel, false);
    assert.equal(f.s.paused, true);
    key('p');
    assert.equal(f.s.paused, false);
    key('h');
    assert.equal(f.ui.showKnowledgePanel, true);
    assert.equal(f.s.paused, true);
    key('p');
    assert.equal(f.s.paused, true);
    key('1');
    assert.equal(f.input.getBuildMode(), null);
    key('Escape');
    assert.equal(f.ui.showKnowledgePanel, false);
    assert.equal(f.s.paused, false);
    f.s.gameOver = true;
    key('r');
    assert.equal(f.retries(), 1);
  } finally {
    f.close();
  }
});

test('a real mouse-down, drag and mouse-up sequence creates one paid connection', () => {
  const f = setup();
  try {
    const core = node('core', 500, 500),
      energy = node('energy', 620, 500);
    energy.connected = false;
    f.s.nodes = [core, energy];
    updateVisibility(f.s);
    const mouse = (type: string, x: number, y: number) =>
      emit(f.canvas, type, { clientX: x, clientY: y, button: 0, ctrlKey: false, shiftKey: false });
    mouse('mousedown', 500, 500);
    mouse('mousemove', 620, 500);
    mouse('mouseup', 620, 500);
    assert.equal(f.s.edges.length, 1);
    assert.equal(f.s.resources, 195);
    assert.equal(energy.connected, true);
    assert.equal(f.s.draggingFrom, null);
  } finally {
    f.close();
  }
});

test('closing key settings restores the pause state from before opening', () => {
  const f = setup();
  try {
    const key = (key: string) =>
      emit(f.keyboard, 'keydown', { key, ctrlKey: false, repeat: false });
    key('k');
    assert.equal(f.s.paused, true);
    key('k');
    assert.equal(f.ui.showKeybindPanel, false);
    assert.equal(f.s.paused, false);
    key('p');
    key('k');
    key('Escape');
    assert.equal(f.s.paused, true);
  } finally {
    f.close();
  }
});

test('scrolling an open key panel cannot zoom the world behind it', () => {
  const f = setup();
  try {
    emit(f.keyboard, 'keydown', { key: 'k', ctrlKey: false, repeat: false });
    const zoom = f.s.camera.targetZoom;
    emit(f.canvas, 'wheel', { deltaY: 100, clientX: 500, clientY: 300 });
    assert.equal(f.s.camera.targetZoom, zoom);
  } finally {
    f.close();
  }
});

test('clicking inside a manual cannot place a building underneath the modal', () => {
  const f = setup();
  try {
    f.s.nodes = [node('core', 500, 500)];
    updateVisibility(f.s);
    emit(f.keyboard, 'keydown', { key: '1', ctrlKey: false, repeat: false });
    emit(f.keyboard, 'keydown', { key: 'h', ctrlKey: false, repeat: false });
    f.ui.openPanelRects = [{ id: 'knowledge', x: 100, y: 100, w: 700, h: 500 }];
    emit(f.canvas, 'mousedown', { clientX: 620, clientY: 400, button: 0, ctrlKey: false });
    emit(f.canvas, 'mouseup', { clientX: 620, clientY: 400, button: 0, ctrlKey: false });
    assert.equal(f.s.nodes.length, 1);
    assert.equal(f.s.resources, 200);
  } finally {
    f.close();
  }
});

test('opening a modal cancels a connection drag before its mouse-up can spend resources', () => {
  const f = setup();
  try {
    f.s.nodes = [node('core', 500, 500), node('energy', 620, 500)];
    updateVisibility(f.s);
    emit(f.canvas, 'mousedown', { clientX: 500, clientY: 500, button: 0, ctrlKey: false });
    emit(f.canvas, 'mousemove', { clientX: 620, clientY: 500 });
    emit(f.keyboard, 'keydown', { key: 't', ctrlKey: false, repeat: false });
    emit(f.canvas, 'mouseup', { clientX: 620, clientY: 500, button: 0, ctrlKey: false });
    assert.equal(f.s.edges.length, 0);
    assert.equal(f.s.resources, 200);
  } finally {
    f.close();
  }
});

test('the pointer remains aligned with the screen while camera zoom changes', () => {
  const f = setup();
  try {
    emit(f.canvas, 'mousemove', { clientX: 200, clientY: 150 });
    f.s.camera.x = 300;
    f.s.camera.y = 100;
    f.s.camera.zoom = 2;
    f.input.updatePointerWorld();
    assert.equal(f.s.mouseX, 400);
    assert.equal(f.s.mouseY, 175);
  } finally {
    f.close();
  }
});

test('moving through the minimap releases selection and an unfinished connection from the old sector', () => {
  const f = setup();
  try {
    const core = node('core', 500, 500);
    f.s.nodes = [core];
    f.s.selectedNodeId = core.id;
    f.s.selectedNodeIds = [core.id];
    f.s.draggingFrom = core.id;
    const map = minimapRect(f.s.canvasWidth, f.s.canvasHeight, f.s.worldWidth, f.s.worldHeight);
    emit(f.canvas, 'mousedown', {
      clientX: map.x + map.w * 0.8,
      clientY: map.y + map.h * 0.5,
      button: 0,
      ctrlKey: false,
    });
    assert.equal(f.s.selectedNodeId, null);
    assert.deepEqual(f.s.selectedNodeIds, []);
    assert.equal(f.s.draggingFrom, null);
  } finally {
    f.close();
  }
});

test('a pause menu owns clicks even if a fading panel still has an old close-button region', () => {
  const f = setup();
  try {
    f.s.paused = true;
    f.ui.pauseMenuOpen = true;
    f.ui.nodeButtons = [{ action: 'close_panel', x: 20, y: 20, w: 40, h: 40, enabled: true }];
    emit(f.canvas, 'mousedown', {
      clientX: 30,
      clientY: 30,
      button: 0,
      ctrlKey: false,
      shiftKey: false,
    });
    assert.equal(f.s.paused, true);
    assert.equal(f.ui.pauseMenuOpen, true);
  } finally {
    f.close();
  }
});

test('locating a base near the west edge centers it in the playable area', () => {
  const f=setup();
  try {
    const core=node('core',300,500);f.s.nodes=[core];
    f.ui.nodeButtons=[{action:`focus:${core.id}`,x:20,y:20,w:80,h:30,enabled:true}];
    emit(f.canvas,'mousedown',{clientX:40,clientY:30,button:0,ctrlKey:false,shiftKey:false});
    assert.equal((core.x-f.s.camera.targetX)*f.s.camera.targetZoom,f.s.canvasWidth/2);
  }finally{f.close();}
});

test('core expansion records paid investment and rejects a neutral core', () => {
  const f=setup();
  try{
    const core=node('core',500,500),neutral=node('core',900,500);neutral.owner='neutral';f.s.nodes=[core,neutral];f.s.resources=1000;f.s.crystals=10;
    const investment=core.investment;f.s.selectedNodeId=core.id;f.ui.nodeButtons=[{action:'expand',x:20,y:20,w:80,h:30,enabled:true}];
    const click=()=>emit(f.canvas,'mousedown',{clientX:40,clientY:30,button:0,ctrlKey:false,shiftKey:false});click();
    assert.equal(core.expanded,true);assert.equal(f.s.resourcesSpent,1000-f.s.resources);assert.equal(core.investment,investment+f.s.resourcesSpent);
    f.s.selectedNodeId=neutral.id;const resources=f.s.resources;click();assert.equal(neutral.expanded,false);assert.equal(f.s.resources,resources);
  }finally{f.close();}
});
