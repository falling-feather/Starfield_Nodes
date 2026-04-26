// ===== 分步教程系统 =====
import type { GameState } from './types';

export interface TutorialStep {
  id: string;
  /** 主标题 */
  title: string;
  /** 说明文字（多行） */
  lines: string[];
  /** 自动完成条件，每帧调用。返回 true 时进入下一步 */
  condition: (state: GameState) => boolean;
  /** 高亮区域类型 */
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
    condition: (state) => state.edges.length >= 1,
    highlight: 'center',
  },
  {
    id: 'build',
    title: '⟨ 第二步：建造节点 ⟩',
    lines: [
      '按 [1] 选择能量站，然后点击空地放置。',
      '能量站会中继并放大能量传输。',
      '',
      '建造一个新节点后自动继续',
    ],
    condition: (state) => state.nodes.filter(n => n.type !== 'core').length >= 1,
    highlight: 'bottom',
  },
  {
    id: 'build_turret',
    title: '⟨ 第三步：防御建设 ⟩',
    lines: [
      '按 [2] 选择炮塔，放置到敌人可能经过的位置。',
      '炮塔会自动攻击范围内的敌人！',
      '别忘了用链路连接它到能量网络。',
      '',
      '建造一座炮塔后自动继续',
    ],
    condition: (state) => state.nodes.some(n => n.type === 'turret'),
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
      '提示：[T]打开科技树 | [3]建矿机产资源',
      '',
      '按 [空格] 开始战斗！',
    ],
    condition: () => false,
    highlight: 'center',
  },
];

// ─── 运行时状态 ─────────────────────────────────

let active = false;
let currentStep = 0;
let completed = false;

const STORAGE_KEY = 'starfield_nodes_tutorial_done';

/** 是否已完成过教程 */
export function isTutorialDone(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

/** 标记教程已完成 */
function markDone(): void {
  localStorage.setItem(STORAGE_KEY, '1');
}

/** 开始教程（仅在首次游戏时调用） */
export function startTutorial(): void {
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
  if (step) {
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
