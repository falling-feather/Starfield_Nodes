import { TERRAIN_SYNERGY } from './data/balance';
// ===== 分步教程系统 =====
import type { GameState } from './types';
import {
  isPointInNebulaPolygon,
  isNearAsteroidPolygonEdge,
  findWormholePolygonAt,
  pointInPolygon,
} from './terrain-poly';

export interface TutorialStep {
  id: string;
  /** 主标题 */
  title: string;
  /** 说明文字（多行） */
  lines: string[];
  /** 自动完成条件，每帧调用。返回 true 时进入下一步 */
  condition: (state: GameState) => boolean;
  /** 高亮区域类型 */
  manual?: boolean;
  highlight?: 'center' | 'bottom' | 'top';
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '⟨ 欢迎来到星域节点 ⟩',
    lines: [
      '你是星域网络的指挥官，',
      '需要建造节点、连接链路来防御敌人入侵。',
      '',
      '按 [空格] 继续...',
    ],
    manual: true,
    condition: () => false, // 手动跳过
    highlight: 'center',
  },
  {
    id: 'connect',
    title: '⟨ 第一步：连接链路 ⟩',
    lines: [
      '从核心节点（中央大节点）拖拽到附近节点，',
      '建立能量链路。能量会沿链路传输！',
      '',
      '拖拽连接一条链路后自动继续',
    ],
    condition: (state) => state.edges.some((e) => !initialEdges.has(e.id)),
    highlight: 'center',
  },
  {
    id: 'build',
    title: '⟨ 第二步：建造节点 ⟩',
    lines: [
      '选择底部的「能量站」卡片，点击核心附近空地放置。',
      '建好后，从核心拖拽一条连线接入它。',
      '',
      '建好并连接新能量站后自动继续',
    ],
    condition: (state) =>
      state.nodes.some((n) => n.type === 'energy' && n.connected && !initialNodes.has(n.id)),
    highlight: 'bottom',
  },
  {
    id: 'build_turret',
    title: '⟨ 第三步：防御建设 ⟩',
    lines: [
      '选择底部的「炮塔」卡片，放置在入侵方向上。',
      '炮塔会自动攻击范围内的敌人！',
      '别忘了用链路连接它到能量网络。',
      '',
      '建好并连接新炮塔后自动继续',
    ],
    condition: (state) =>
      state.nodes.some((n) => n.type === 'turret' && n.connected && !initialNodes.has(n.id)),
    highlight: 'bottom',
  },
  {
    id: 'camera',
    title: '⟨ 第四步：视角控制 ⟩',
    lines: [
      'Ctrl + 左键拖拽 → 平移视角',
      '滚轮 → 缩放视角',
      '地图比屏幕大，记得探索周围！',
      '',
      '按 [空格] 继续...',
    ],
    manual: true,
    condition: () => false,
    highlight: 'center',
  },
  {
    id: 'survive',
    title: '⟨ 最后：守护核心！ ⟩',
    lines: [
      '敌人会持续攻击你的节点。',
      '保护核心不被摧毁即可取得胜利！',
      '',
      '选中节点按 [U] 升级；[T] 研究，[P] 规划。',
      '',
      '按 [空格] 开始战斗！',
    ],
    manual: true,
    condition: () => false,
    highlight: 'center',
  },
];

// ─── 运行时状态 ─────────────────────────────────

let active = false;
let currentStep = 0;
let completed = false;
let initialNodes = new Set<string>();
let initialEdges = new Set<string>();

const STORAGE_KEY = 'starfield_nodes_tutorial_v2_done';

/** 是否已完成过教程 */
export function isTutorialDone(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

/** 标记教程已完成 */
function markDone(): void {
  localStorage.setItem(STORAGE_KEY, '1');
}

/** 开始教程（仅在首次游戏时调用） */
export function startTutorial(state: GameState): void {
  initialNodes = new Set(state.nodes.map((n) => n.id));
  initialEdges = new Set(state.edges.map((e) => e.id));
  if (isTutorialDone()) return;
  active = true;
  currentStep = 0;
  completed = false;
}

/** 教程是否正在进行 */
export function isTutorialActive(): boolean {
  return active && !completed;
}

/** 跳过/结束教程 */
export function skipTutorial(): void {
  active = false;
  completed = true;
  markDone();
}

/** 手动推进（空格键） */
export function advanceTutorial(): boolean {
  if (!active || completed) return false;
  const step = STEPS[currentStep];
  // 当前步骤无自动条件 → 空格推进
  if (step?.manual) {
    currentStep++;
    if (currentStep >= STEPS.length) {
      skipTutorial();
    }
    return true;
  }
  return false;
}

/** 每帧更新：检查自动条件 */
export function updateTutorial(state: GameState): void {
  if (!active || completed) return;
  const step = STEPS[currentStep];
  if (step && step.condition(state)) {
    currentStep++;
    if (currentStep >= STEPS.length) {
      skipTutorial();
    }
  }
}

/** 获取当前教程步骤（null 表示无教程） */
export function getCurrentStep(): TutorialStep | null {
  if (!active || completed || currentStep >= STEPS.length) return null;
  return STEPS[currentStep];
}

/** 获取进度文字 */
export function getProgress(): string {
  return `${currentStep + 1}/${STEPS.length}`;
}

// ===== V1.5.0 知识点提示（Lore Tips）=====
// 与新手 STEPS 独立：每条 tip 仅在玩家**首次**进入存在对应地形的关卡时弹出一次（localStorage 持久）

export interface LoreTip {
  id: string;
  title: string;
  lines: string[];
  color: string;
}

export const LORE_TIPS: Record<string, LoreTip> = {
  terrain_nebula: {
    id: 'terrain_nebula',
    title: '★ 知识：星云地形',
    lines: [
      '能量站 节点位于 星云区域内时，每 步 充能 ×1.30。',
      '把发电机藏进星云能显著提升电网容量。',
    ],
    color: '#7da6ff',
  },
  terrain_asteroid: {
    id: 'terrain_asteroid',
    title: '★ 知识：陨石带边缘',
    lines: [
      '炮塔 / 狙击塔 距离 小行星带边界边 ≤ 90 像素时，射程 ×1.25。',
      '沿陨石带外缘布防，火力覆盖更远。',
    ],
    color: '#ff9b6b',
  },
  terrain_wormhole: {
    id: 'terrain_wormhole',
    title: '★ 知识：虫洞枢纽',
    lines: [
      '近端中继通电后可侦察彼岸，再接管远端中继。',
      '双端中继接通后能够跨域输能，长主干需要充足产能。',
      '远端核心可独立供电；两端能量站可互相增加20%产能。',
    ],
    color: '#a8dcff',
  },
  // V1.5.2 主动引导：energy 拖进 nebula
  challenge_energy_in_nebula: {
    id: 'challenge_energy_in_nebula',
    title: '可选挑战：充能优化',
    lines: [
      '当前关卡包含星云地形。',
      '尝试把一个 能量站 节点建在 星云 内部。',
      '成功后该节点充能×1.30。',
    ],
    color: '#7da6ff',
  },
  challenge_energy_in_nebula_done: {
    id: 'challenge_energy_in_nebula_done',
    title: '发现完成：星云充能激活',
    lines: ['能量站 节点进入星云 → 充能×1.30。', '可叠加虫洞枢纽×1.20，总倍率 ×1.56。'],
    color: '#7da6ff',
  },
  // V1.5.3 任务：turret/sniper 布防在陕石带边缘
  challenge_turret_near_asteroid: {
    id: 'challenge_turret_near_asteroid',
    title: '可选挑战：边缘布防',
    lines: [
      '当前关卡包含陕石带地形。',
      '尝试把 炮塔 或 狙击塔 建在 小行星带 边缘±90像素内。',
      '成功后该节点射程×1.25。',
    ],
    color: '#ff9b6b',
  },
  challenge_turret_near_asteroid_done: {
    id: 'challenge_turret_near_asteroid_done',
    title: '发现完成：陕石带增程激活',
    lines: ['炮塔/狙击塔 在陕石带边缘 → 射程×1.25。', '推荐沿陕石带外缘连拉一条防线。'],
    color: '#ff9b6b',
  },
  // V1.5.4 任务：虫洞枢纽（同方 energy 在两端）
  challenge_wormhole_energy_pair: {
    id: 'challenge_wormhole_energy_pair',
    title: '可选挑战：虫洞枢纽',
    lines: [
      '当前关卡包含虫洞区域对。',
      '在一对虫洞两端各放一个 能量站 节点。',
      '双端己方充能×1.20，远程供能枢纽成形。',
    ],
    color: '#a8dcff',
  },
  challenge_wormhole_energy_pair_done: {
    id: 'challenge_wormhole_energy_pair_done',
    title: '发现完成：虫洞枢纽打通',
    lines: [
      '己方 能量站 跨虫洞双端 → 充能×1.20。',
      '进阶：双端中继可跨域输能，其他枢纽联动可在作战手册查看。',
    ],
    color: '#a8dcff',
  },
  // V1.5.8 虫洞进阶：Relay 双端
  challenge_wormhole_relay_pair: {
    id: 'challenge_wormhole_relay_pair',
    title: '可选挑战：跨虫洞中继',
    lines: [
      '在一对虫洞两端各放一个 中继器 节点。',
      '双端中继接通后能够跨域输送能量，',
      '能量网络可远程跳点、跨越地形障碍。',
    ],
    color: '#78c8ff',
  },
  challenge_wormhole_relay_pair_done: {
    id: 'challenge_wormhole_relay_pair_done',
    title: '发现完成：跨虫洞中继启用',
    lines: ['己方 中继器 跨虫洞双端 → 能量网络远程跳点。', '可与 能量站/缓冲器 枢纽叠加使用。'],
    color: '#78c8ff',
  },
  // V1.5.8 虫洞进阶：Buffer 双端
  challenge_wormhole_buffer_pair: {
    id: 'challenge_wormhole_buffer_pair',
    title: '可选挑战：跨虫洞共振',
    lines: [
      '在一对虫洞两端各放一个 缓冲器 节点。',
      '两端 缓冲器 会共振 光环，',
      '远程加成另一端附近节点。',
    ],
    color: '#a8dcff',
  },
  challenge_wormhole_buffer_pair_done: {
    id: 'challenge_wormhole_buffer_pair_done',
    title: '发现完成：跨虫洞共振启用',
    lines: ['己方 缓冲器 跨虫洞双端 → 光环 跨空间广播。', '适合保护远点孤立的防线。'],
    color: '#a8dcff',
  },
};

const LORE_STORAGE = 'starfield_nodes_lore_seen';

function loadSeenLore(): Set<string> {
  try {
    const raw = localStorage.getItem(LORE_STORAGE);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenLore(s: Set<string>): void {
  try {
    localStorage.setItem(LORE_STORAGE, JSON.stringify([...s]));
  } catch {
    /* quota / private mode → 静默 */
  }
}

/** 扫描当前关卡 terrainPolygons，返回应该弹出的 lore tip id 列表（首次见的），并把它们标记为已读 */
export function checkLoreTipsForLevel(state: GameState): string[] {
  const seen = loadSeenLore();
  const out: string[] = [];
  const types = new Set(state.terrainPolygons.map((p) => p.type));
  const map: Record<string, string> = {
    nebula: 'terrain_nebula',
    asteroid: 'terrain_asteroid',
    wormhole: 'terrain_wormhole',
  };
  for (const [t, id] of Object.entries(map)) {
    if (types.has(t as 'nebula' | 'asteroid' | 'wormhole') && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  if (out.length > 0) saveSeenLore(seen);
  return out;
}

/** 测试/调试用：清空已读记录（让所有 tip 下次再弹一次） */
export function resetLoreTips(): void {
  try {
    localStorage.removeItem(LORE_STORAGE);
  } catch {
    /* ignore */
  }
}

/** V1.5.5 该 lore id 是否已被玩家触发过（用于知识库面板状态徽章） */
export function isLoreSeen(id: string): boolean {
  return loadSeenLore().has(id);
}

/** V1.5.10 已完成的知识库任务数量（challenge_*_done seen 数） */
export function getCompletedChallengeCount(): number {
  const seen = loadSeenLore();
  let n = 0;
  for (const id of Object.keys(LORE_TIPS)) {
    if (id.startsWith('challenge_') && id.endsWith('_done') && seen.has(id)) n++;
  }
  return n;
}

// V1.5.2 每帧检查主动引导任务点（状态驱动，不仅仅看地形）
/** 返回应该弹出的 challenge tip id 列表（首次触发）并标记已读 */
export function checkChallengeTips(state: GameState): string[] {
  const seen = loadSeenLore();
  const out: string[] = [];
  const hasNebula = state.terrainPolygons.some((p) => p.type === 'nebula');
  if (hasNebula) {
    const energyInNebula = state.nodes.some(
      (n) =>
        n.type === 'energy' &&
        n.owner === 'player' &&
        n.status !== 'destroyed' &&
        n.connected &&
        n.currentEnergy >= n.activationThreshold &&
        isPointInNebulaPolygon(state, n.x, n.y),
    );
    // 任务提示：关卡有星云但玩家还没把 energy 拖进去
    if (!energyInNebula && !seen.has('challenge_energy_in_nebula')) {
      out.push('challenge_energy_in_nebula');
      seen.add('challenge_energy_in_nebula');
    }
    // 完成提示：玩家首次把 energy 拖进 nebula
    if (energyInNebula && !seen.has('challenge_energy_in_nebula_done')) {
      out.push('challenge_energy_in_nebula_done');
      seen.add('challenge_energy_in_nebula_done');
    }
  }
  // V1.5.3 turret/sniper 近陕石带边缘
  const hasAsteroid = state.terrainPolygons.some((p) => p.type === 'asteroid');
  if (hasAsteroid) {
    const turretNearEdge = state.nodes.some(
      (n) =>
        (n.type === 'turret' || n.type === 'sniper') &&
        n.owner === 'player' &&
        n.status !== 'destroyed' &&
        n.connected &&
        n.currentEnergy >= n.activationThreshold &&
        isNearAsteroidPolygonEdge(state, n.x, n.y, TERRAIN_SYNERGY.asteroidEdgeRange),
    );
    if (!turretNearEdge && !seen.has('challenge_turret_near_asteroid')) {
      out.push('challenge_turret_near_asteroid');
      seen.add('challenge_turret_near_asteroid');
    }
    if (turretNearEdge && !seen.has('challenge_turret_near_asteroid_done')) {
      out.push('challenge_turret_near_asteroid_done');
      seen.add('challenge_turret_near_asteroid_done');
    }
  }
  // V1.5.4 虫洞枢纽：同方 energy 在一对虫洞两端
  const hasWormhole = state.terrainPolygons.some((p) => p.type === 'wormhole' && p.linkedId);
  if (hasWormhole) {
    // 抽取：检查在一对虫洞两端是否有同方同类节点
    const hasPlayerPairOfType = (nodeType: string): boolean => {
      for (const n of state.nodes) {
        if (
          n.type !== nodeType ||
          n.owner !== 'player' ||
          n.status === 'destroyed' ||
          !n.connected ||
          n.currentEnergy < n.activationThreshold
        )
          continue;
        const here = findWormholePolygonAt(state, n.x, n.y);
        if (!here || !here.linkedId) continue;
        const linked = state.terrainPolygons.find(
          (p) => p.id === here.linkedId && p.type === 'wormhole',
        );
        if (!linked) continue;
        if (
          state.nodes.some(
            (m) =>
              m !== n &&
              m.type === nodeType &&
              m.owner === 'player' &&
              m.status !== 'destroyed' &&
              m.connected &&
              m.currentEnergy >= m.activationThreshold &&
              pointInPolygon(m.x, m.y, linked),
          )
        )
          return true;
      }
      return false;
    };
    // 主任务：energy 双端
    const wormholeEnergyPair = hasPlayerPairOfType('energy');
    if (!wormholeEnergyPair && !seen.has('challenge_wormhole_energy_pair')) {
      out.push('challenge_wormhole_energy_pair');
      seen.add('challenge_wormhole_energy_pair');
    }
    if (wormholeEnergyPair && !seen.has('challenge_wormhole_energy_pair_done')) {
      out.push('challenge_wormhole_energy_pair_done');
      seen.add('challenge_wormhole_energy_pair_done');
    }
    // V1.5.8 进阶任务：仅在主任务完成后解锁（避免一下弹 3 张同类 toast）
    if (seen.has('challenge_wormhole_energy_pair_done')) {
      const wormholeRelayPair = hasPlayerPairOfType('relay');
      if (!wormholeRelayPair && !seen.has('challenge_wormhole_relay_pair')) {
        out.push('challenge_wormhole_relay_pair');
        seen.add('challenge_wormhole_relay_pair');
      }
      if (wormholeRelayPair && !seen.has('challenge_wormhole_relay_pair_done')) {
        out.push('challenge_wormhole_relay_pair_done');
        seen.add('challenge_wormhole_relay_pair_done');
      }
      const wormholeBufferPair = hasPlayerPairOfType('buffer');
      if (!wormholeBufferPair && !seen.has('challenge_wormhole_buffer_pair')) {
        out.push('challenge_wormhole_buffer_pair');
        seen.add('challenge_wormhole_buffer_pair');
      }
      if (wormholeBufferPair && !seen.has('challenge_wormhole_buffer_pair_done')) {
        out.push('challenge_wormhole_buffer_pair_done');
        seen.add('challenge_wormhole_buffer_pair_done');
      }
    }
  }
  if (out.length > 0) saveSeenLore(seen);
  return out;
}
