import './style.css'
import './focus-stack' // 模态焦点栈：必须在任何屏幕之前 import，完成 capture-phase keydown 拦截注册
import { Game } from './game'
import { LoginScreen } from './login'
import { LevelSelectScreen } from './level-select'
import { NodeSelectScreen } from './node-select'
import { CutsceneScreen } from './cutscene'
import type { SaveProfile } from './save'
import { LEVELS } from './levels'
import type { LevelConfig } from './levels'
import type { NodeType } from './types'
import { loadProfiles, setTamperHandler } from './save'
import { transitionTo, instantBlack, fadeIn } from './transition'
import { ANIM } from './ui-tokens'
import { loadStoredTheme } from './themes'
import { toggleThemePicker } from './theme-picker'
import { initSeedFromURL, getSeed } from './rng'
import { parseBenchParams, runBenchmark } from './benchmark'
import * as saveSig from './save-sig'

const canvas = document.createElement('canvas');
canvas.id = 'game-canvas';
document.getElementById('app')!.appendChild(canvas);

// 基本 canvas 设置
function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let currentGame: Game | null = null;

/** 存档篡改/损坏轻量提示 */
function showTamperToast(reason: 'invalid_sig' | 'parse_error'): void {
  const div = document.createElement('div');
  const msg = reason === 'invalid_sig' ? '存档校验失败，已重置' : '存档解析失败，已重置';
  div.textContent = `⚠ ${msg}`;
  div.style.cssText = [
    'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
    'padding:10px 18px', 'background:rgba(40,10,10,0.92)', 'color:#ff8866',
    'border:1px solid #ff4444', 'border-radius:6px', 'font:14px monospace',
    'z-index:9999', 'box-shadow:0 4px 12px rgba(255,68,68,0.3)',
    'transition:opacity 300ms', 'opacity:0',
  ].join(';');
  document.body.appendChild(div);
  requestAnimationFrame(() => { div.style.opacity = '1'; });
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 320);
  }, 4000);
}

// ─── 流程函数 ─────────────────────────────────

/** 向后兼容：修补老存档缺失的字段 */
function patchProfile(profile: SaveProfile): void {
  if (!profile.clearedLevels) profile.clearedLevels = [];
  if (!profile.unlockedAchievements) profile.unlockedAchievements = [];
}

/** 1) 登录后 → 进入关卡选择 */
function onLoggedIn(profile: SaveProfile): void {
  patchProfile(profile);
  void transitionTo(() => showLevelSelect(profile));
}

/** 2) 关卡选择界面 */
function showLevelSelect(profile: SaveProfile): void {
  // GM模式：falling-feather 解锁全部关卡
  const cleared = profile.name === 'falling-feather'
    ? LEVELS.map(l => l.id)
    : profile.clearedLevels;
  new LevelSelectScreen(canvas, cleared, (level: LevelConfig) => {
    void transitionTo(() => showCutscene(profile, level));
  });
}

/** 2.5) 过场动画 */
function showCutscene(profile: SaveProfile, level: LevelConfig): void {
  new CutsceneScreen(canvas, level.id, () => {
    void transitionTo(() => showNodeSelect(profile, level));
  });
}

/** 3) 节点选卡界面 */
function showNodeSelect(profile: SaveProfile, level: LevelConfig): void {
  new NodeSelectScreen(canvas, level, (selectedNodes: NodeType[]) => {
    void transitionTo(
      () => startGame(profile, level, selectedNodes),
      { fadeOutMs: ANIM.enterGameOut, fadeInMs: ANIM.enterGameIn },
    );
  });
}

/** 4) 开始游戏 */
function startGame(profile: SaveProfile, level: LevelConfig, selectedNodes: NodeType[]): void {
  currentGame = new Game(canvas, profile, level, selectedNodes, (won: boolean) => {
    void won;
    void transitionTo(
      () => {
        currentGame?.stop();
        currentGame = null;
        // 重新加载最新的存档（游戏内已 saveProfile）
        const freshProfiles = loadProfiles();
        const freshProfile = freshProfiles.find(p => p.name === profile.name) ?? profile;
        patchProfile(freshProfile);
        showLevelSelect(freshProfile);
      },
      { fadeOutMs: ANIM.exitGameOut, fadeInMs: ANIM.exitGameIn },
    );
  });
  currentGame.start();
}

// ─── 启动入口 ─────────────────────────────────

// 首屏先盖一层黑，避免初始未绘制时的白闪
instantBlack();
// 加载用户主题偏好（启动期就应用调色板，然后首渲染才会拿到正确色值）
loadStoredTheme();
// 存档篡改/损坏时弹一个 DOM 浮层（仅持续 5s，避免阻断流程）
setTamperHandler((reason) => {
  showTamperToast(reason);
});
// ?debug=1：暴露存档签名工具到 window，供本地验证 __sig 单条丢弃流程
if (new URLSearchParams(location.search).get('debug') === '1') {
  (window as unknown as { __saveSig: typeof saveSig }).__saveSig = saveSig;
  console.info('[debug] window.__saveSig = { signPayload, verifyPayload, signProfile, verifyProfile, cyrb53 }');
}
// 从 URL 参数 ?seed=N 注入随机种子（Phase B-2 benchmark 复现）
if (initSeedFromURL()) {
  console.info(`[seed] benchmark seed = ${getSeed()}`);
}
// Benchmark 模式：?bench=1 跳过所有 UI 直接进游戏
const benchParams = parseBenchParams();
if (benchParams.enabled) {
  void fadeIn(0);
  runBenchmark(canvas, benchParams);
} else {
  new LoginScreen(canvas, onLoggedIn);
}
// 全局快捷键：Shift+T 唤出/关闭主题选择面板
window.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
    e.preventDefault();
    toggleThemePicker();
  }
});
// 等登录屏幕首帧完成后再淡入
requestAnimationFrame(() => requestAnimationFrame(() => { void fadeIn(ANIM.bootFadeIn); }));

