// ===== 主题切换 =====
// 通过深度合并 override 到全局可变 COLORS 实现实时换肤；
// 已订阅 themeBus 的屏幕在 'change' 事件中重绘即可看到效果。

import { COLORS, DEFAULT_COLORS } from './ui-tokens';
import { NODE_CONFIGS, DEFAULT_NODE_GLOW } from './data/nodes';
import { ENEMY_COLORS, DEFAULT_ENEMY_COLORS } from './data/enemies';
import { EDGE_CONFIGS, DEFAULT_EDGE_COLORS } from './data/edges';
import type { NodeType, EnemyType, EdgeType } from './types';

/** 主题颜色形状（与 COLORS 同构） */
export type ThemePalette = typeof COLORS;

/** 部分主题（嵌套可选） */
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type ThemeOverride = DeepPartial<ThemePalette>;

/** 节点光晕色覆盖：仅列出需要变更的节点类型 */
export type NodeGlowOverride = Partial<Record<NodeType, string>>;

/** 敌人色覆盖 */
export type EnemyColorOverride = Partial<Record<EnemyType, string>>;

/** 边色覆盖 */
export type EdgeColorOverride = Partial<Record<EdgeType, string>>;

interface ThemeDef {
  label: string;
  override: ThemeOverride;
  /** 可选：覆盖节点光晕色（默认沿用 DEFAULT_NODE_GLOW） */
  nodeGlow?: NodeGlowOverride;
  /** 可选：覆盖敌人色 */
  enemyColor?: EnemyColorOverride;
  /** 可选：覆盖边色 */
  edgeColor?: EdgeColorOverride;
}

/** 预设主题：仅声明差异部分，余下回退到默认 COLORS */
export const THEMES: Record<string, ThemeDef> = {
  cyan: {
    label: '默认·星青',
    override: {}, // 与默认 COLORS 一致
  },
  warm: {
    label: '暖橙·黄昏',
    override: {
      accent: {
        cyan: '#ffaa66',      // 主色：暖橙
        cyanSoft: '#ffcc99',  // 次级：浅橙
        purple: '#ff7733',    // 强化：焦糖
        pink: '#ff66aa',      // 进化：暖玫红
        green: '#ffd166',     // 资源：金黄（避免冷绿）
        greenSoft: '#ddaa55',
        yellow: '#ffaa00',
        yellowHi: '#ffcc44',
        red: '#ff5544',
        redSoft: '#ff8866',
        blue: '#ff9966',      // 连线：与主色协调
        crystal: '#ffaa77',
      },
      bg: {
        overlay: 'rgba(20,8,0,0.7)',
        panel: 'rgba(30,15,5,0.92)',
        panelDim: 'rgba(40,20,10,0.8)',
        card: 'rgba(20,10,5,0.88)',
        pure: '#000000',
      },
      border: {
        cyanFaint: 'rgba(255,170,102,0.3)',
        cyanGhost: 'rgba(255,170,102,0.08)',
      },
    },
    nodeGlow: {
      core: '#ffaa66',
      energy: '#ffd166',
      turret: '#ff5544',
      mine: '#ffaa00',
      shield: '#ff7733',
      relay: '#ff9966',
      tesla: '#ffcc44',
      beacon: '#ffeecc',
      factory: '#ff8800',
      magnet: '#ff66aa',
      trap: '#ff4422',
      repair: '#ffd166',
      sniper: '#ff6644',
      buffer: '#ffcc00',
      collector: '#ffbb88',
      interceptor: '#ff9966',
      radar: '#ffccaa',
      portal: '#ff7733',
      blackhole: '#aa5522',
      echo: '#ffbb99',
      toxin: '#ddaa44',
      arc: '#ff9966',
      kamikaze: '#ff5544',
    },
    enemyColor: {
      scout: '#ff7755', heavy: '#ff5522', swarm: '#ffaa44', boss: '#ff3300',
      stealth: '#ffcc99', splitter: '#ffdd55', disruptor: '#ff8866',
      healer: '#ffd166', shielder: '#ff9966',
    },
    edgeColor: {
      fast: '#ffcc66', heavy: '#ff7733', amplify: '#ff9966',
    },
  },
  mono: {
    label: '极简·灰阶',
    override: {
      accent: {
        cyan: '#dddddd',
        cyanSoft: '#bbbbbb',
        purple: '#cccccc',
        pink: '#dddddd',
        green: '#bbbbbb',
        greenSoft: '#999999',
        yellow: '#eeeeee',
        yellowHi: '#ffffff',
        red: '#ffaaaa',     // 危险仍保留淡红，便于辨识
        redSoft: '#ddaaaa',
        blue: '#aaaaaa',
        crystal: '#cccccc',
      },
      bg: {
        overlay: 'rgba(0,0,0,0.75)',
        panel: 'rgba(15,15,18,0.92)',
        panelDim: 'rgba(25,25,28,0.8)',
        card: 'rgba(0,0,0,0.88)',
        pure: '#000000',
      },
      border: {
        cyanFaint: 'rgba(200,200,200,0.3)',
        cyanGhost: 'rgba(200,200,200,0.08)',
      },
    },
    nodeGlow: {
      core: '#ffffff',
      energy: '#dddddd',
      turret: '#ffaaaa',
      mine: '#eeeeee',
      shield: '#cccccc',
      relay: '#aaaaaa',
      tesla: '#eeeeee',
      beacon: '#ffffff',
      factory: '#cccccc',
      magnet: '#bbbbbb',
      trap: '#ff9999',
      repair: '#cccccc',
      sniper: '#ff8888',
      buffer: '#eeeeee',
      collector: '#bbbbbb',
      interceptor: '#aaaaaa',
      radar: '#cccccc',
      portal: '#cccccc',
      blackhole: '#888888',
      echo: '#bbbbbb',
      toxin: '#aaaaaa',
      arc: '#aaaaaa',
      kamikaze: '#ffaaaa',
    },
    enemyColor: {
      scout: '#cccccc', heavy: '#aaaaaa', swarm: '#dddddd', boss: '#ffaaaa',
      stealth: '#eeeeee', splitter: '#bbbbbb', disruptor: '#cccccc',
      healer: '#bbbbbb', shielder: '#aaaaaa',
    },
    edgeColor: {
      fast: '#cccccc', heavy: '#888888', amplify: '#bbbbbb',
    },
  },
  sakura: {
    label: '樱·粉雪',
    override: {
      accent: {
        cyan: '#ff99cc',
        cyanSoft: '#ffbbdd',
        purple: '#cc88ff',
        pink: '#ff77bb',
        green: '#aaffcc',
        greenSoft: '#88ddaa',
        yellow: '#ffdd88',
        yellowHi: '#ffeebb',
        red: '#ff6688',
        redSoft: '#ff99aa',
        blue: '#aabbff',
        crystal: '#ddaaff',
      },
      bg: {
        overlay: 'rgba(40,10,30,0.7)',
        panel: 'rgba(50,15,40,0.92)',
        panelDim: 'rgba(60,20,50,0.8)',
        card: 'rgba(30,10,25,0.88)',
        pure: '#000000',
      },
      border: {
        cyanFaint: 'rgba(255,153,204,0.3)',
        cyanGhost: 'rgba(255,153,204,0.08)',
      },
    },
    nodeGlow: {
      core: '#ff99cc',
      energy: '#aaffcc',
      turret: '#ff6688',
      mine: '#ffdd88',
      shield: '#cc88ff',
      relay: '#aabbff',
      tesla: '#ffeebb',
      beacon: '#ffffff',
      factory: '#ffaa88',
      magnet: '#ff77bb',
      trap: '#ff5577',
      repair: '#aaffcc',
      sniper: '#ff7799',
      buffer: '#ffdd99',
      collector: '#ffbbdd',
      interceptor: '#aabbff',
      radar: '#ddccff',
      portal: '#cc88ff',
      blackhole: '#aa55cc',
      echo: '#bbddff',
      toxin: '#ccdd77',
      arc: '#aabbff',
      kamikaze: '#ff5588',
    },
    enemyColor: {
      scout: '#ff77aa', heavy: '#cc6699', swarm: '#cc88ff', boss: '#ff4477',
      stealth: '#ddccff', splitter: '#aaffcc', disruptor: '#ff99dd',
      healer: '#aaffcc', shielder: '#aabbff',
    },
    edgeColor: {
      fast: '#aabbff', heavy: '#ff77bb', amplify: '#cc88ff',
    },
  },
  contrast: {
    label: '高对比·荧光',
    override: {
      accent: {
        cyan: '#00ffff',
        cyanSoft: '#66ffff',
        purple: '#ff00ff',
        pink: '#ff44ff',
        green: '#00ff00',
        greenSoft: '#66ff66',
        yellow: '#ffff00',
        yellowHi: '#ffff66',
        red: '#ff0000',
        redSoft: '#ff6666',
        blue: '#0088ff',
        crystal: '#ff00aa',
      },
      text: {
        primary: '#ffffff',
        high: '#ffffff',
        body: '#eeeeee',
        muted: '#cccccc',
        faint: '#aaaaaa',
        disabled: '#888888',
        border: '#666666',
        borderFaint: '#444444',
      },
      bg: {
        overlay: 'rgba(0,0,0,0.85)',
        panel: 'rgba(0,0,0,0.95)',
        panelDim: 'rgba(0,0,0,0.85)',
        card: 'rgba(0,0,0,0.92)',
        pure: '#000000',
      },
      border: {
        cyanFaint: 'rgba(0,255,255,0.5)',
        cyanGhost: 'rgba(0,255,255,0.15)',
      },
    },
    enemyColor: {
      scout: '#ff0000', heavy: '#ff8800', swarm: '#ff00ff', boss: '#ff0044',
      stealth: '#00ffff', splitter: '#aaff00', disruptor: '#ff44ff',
      healer: '#00ff88', shielder: '#0088ff',
    },
    edgeColor: {
      fast: '#00ffff', heavy: '#ffaa00', amplify: '#ff00ff',
    },
  },
  forest: {
    label: '深林·翠绿',
    override: {
      accent: {
        cyan: '#88ffaa',
        cyanSoft: '#aaffcc',
        purple: '#66ddbb',
        pink: '#bbff77',
        green: '#44ff88',
        greenSoft: '#66cc77',
        yellow: '#ddff66',
        yellowHi: '#eeff88',
        red: '#ff7755',
        redSoft: '#ff9977',
        blue: '#66ccaa',
        crystal: '#aaff88',
      },
      bg: {
        overlay: 'rgba(5,20,10,0.72)',
        panel: 'rgba(8,25,15,0.92)',
        panelDim: 'rgba(15,35,22,0.8)',
        card: 'rgba(5,15,8,0.88)',
        pure: '#000000',
      },
      border: {
        cyanFaint: 'rgba(136,255,170,0.3)',
        cyanGhost: 'rgba(136,255,170,0.08)',
      },
    },
    nodeGlow: {
      core: '#88ffaa',
      energy: '#44ff88',
      turret: '#ff7755',
      mine: '#ddff66',
      shield: '#66ddbb',
      relay: '#66ccaa',
      tesla: '#aaff44',
      beacon: '#eeffcc',
      factory: '#ff9966',
      magnet: '#bbff77',
      trap: '#ff5544',
      repair: '#aaffaa',
      sniper: '#ff8866',
      buffer: '#ddff77',
      collector: '#aaff99',
      interceptor: '#88ddaa',
      radar: '#ccffcc',
      portal: '#aaff88',
      blackhole: '#446644',
      echo: '#88ddcc',
      toxin: '#88cc44',
      arc: '#66ccaa',
      kamikaze: '#ff7755',
    },
    enemyColor: {
      scout: '#88ff99', heavy: '#66cc77', swarm: '#aaff66', boss: '#44dd44',
      stealth: '#ccffcc', splitter: '#bbff88', disruptor: '#aaff77',
      healer: '#88ffaa', shielder: '#66ccaa',
    },
    edgeColor: {
      fast: '#aaffcc', heavy: '#66cc77', amplify: '#88ddbb',
    },
  },
};

const STORAGE_KEY = 'starfield.theme';
const DEFAULT_NAME = 'cyan';

let currentName: string = DEFAULT_NAME;

/** 主题变更事件总线（type='change', detail={name}） */
export const themeBus = new EventTarget();

/** 深度赋值：把 src 的字段就地写入 target（仅覆盖已存在的同名字段） */
function deepAssign(target: any, src: any): void {
  if (!src || typeof src !== 'object') return;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

/** 把 COLORS 重置为默认值（用于切主题时清掉旧 override） */
function resetColors(): void {
  deepAssign(COLORS, DEFAULT_COLORS);
}

/** 把 NODE_CONFIGS 的 glowColor 重置为默认快照 */
function resetNodeGlow(): void {
  for (const k of Object.keys(DEFAULT_NODE_GLOW) as NodeType[]) {
    NODE_CONFIGS[k].glowColor = DEFAULT_NODE_GLOW[k];
  }
}

/** 应用节点光晕覆盖 */
function applyNodeGlow(override?: NodeGlowOverride): void {
  if (!override) return;
  for (const k of Object.keys(override) as NodeType[]) {
    const v = override[k];
    if (v && NODE_CONFIGS[k]) NODE_CONFIGS[k].glowColor = v;
  }
}

/** 重置敌人色 */
function resetEnemyColors(): void {
  for (const k of Object.keys(DEFAULT_ENEMY_COLORS) as EnemyType[]) {
    ENEMY_COLORS[k] = DEFAULT_ENEMY_COLORS[k];
  }
}

/** 应用敌人色覆盖 */
function applyEnemyColors(override?: EnemyColorOverride): void {
  if (!override) return;
  for (const k of Object.keys(override) as EnemyType[]) {
    const v = override[k];
    if (v) ENEMY_COLORS[k] = v;
  }
}

/** 重置边色 */
function resetEdgeColors(): void {
  for (const k of Object.keys(DEFAULT_EDGE_COLORS) as EdgeType[]) {
    EDGE_CONFIGS[k].color = DEFAULT_EDGE_COLORS[k];
  }
}

/** 应用边色覆盖 */
function applyEdgeColors(override?: EdgeColorOverride): void {
  if (!override) return;
  for (const k of Object.keys(override) as EdgeType[]) {
    const v = override[k];
    if (v && EDGE_CONFIGS[k]) EDGE_CONFIGS[k].color = v;
  }
}

/** 加载用户偏好（从 localStorage），并立刻应用 */
export function loadStoredTheme(): string {
  let name = DEFAULT_NAME;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && THEMES[v]) name = v;
  } catch {
    // ignore (localStorage 可能在某些环境不可用)
  }
  applyTheme(name, /*silent*/ true);
  return name;
}

/** 当前主题名 */
export function getThemeName(): string {
  return currentName;
}

/**
 * 切换主题：深合并 override 到 COLORS、写入 localStorage、广播 'change'。
 * @param silent 为 true 时不写 localStorage、不派发事件（用于启动期初始化）
 */
export function applyTheme(name: string, silent = false): void {
  if (!THEMES[name]) {
    console.warn('[theme] unknown theme:', name);
    return;
  }
  currentName = name;
  resetColors();
  resetNodeGlow();
  resetEnemyColors();
  resetEdgeColors();
  deepAssign(COLORS, THEMES[name].override);
  applyNodeGlow(THEMES[name].nodeGlow);
  applyEnemyColors(THEMES[name].enemyColor);
  applyEdgeColors(THEMES[name].edgeColor);
  if (silent) return;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore
  }
  themeBus.dispatchEvent(new CustomEvent('change', { detail: { name } }));
}

/** 列出可用主题（用于设置 UI） */
export function listThemes(): { name: string; label: string }[] {
  return Object.entries(THEMES).map(([name, t]) => ({ name, label: t.label }));
}

/** 切到下一个主题（用于全局快捷键 T） */
export function cycleTheme(): string {
  const names = Object.keys(THEMES);
  const idx = names.indexOf(currentName);
  const next = names[(idx + 1) % names.length];
  applyTheme(next);
  return next;
}

