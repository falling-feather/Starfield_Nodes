// ===== 程序化音效系统 (Web Audio API) =====

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let initialized = false;

/** 初始化音频上下文（需在用户交互后调用） */
export function initAudio(): void {
  if (initialized) return;
  try {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(ctx.destination);
    initialized = true;
  } catch {
    // Web Audio 不可用
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.3;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

// ─── 辅助工具 ─────────────────────────────────

function ensureCtx(): AudioContext | null {
  if (!ctx || !masterGain) return null;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function makeOsc(
  ac: AudioContext,
  type: OscillatorType,
  freq: number,
  duration: number,
  volume: number = 0.3,
  detune: number = 0,
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

function makeNoise(ac: AudioContext, duration: number, volume: number = 0.1): void {
  const bufSize = Math.floor(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  src.connect(gain);
  gain.connect(masterGain!);
  src.start();
  src.stop(ac.currentTime + duration);
}

// ─── 音效 ─────────────────────────────────────

/** 炮塔射击 */
export function sfxShoot(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'square', 800 + Math.random() * 200, 0.08, 0.15);
  makeOsc(ac, 'sawtooth', 400, 0.05, 0.08);
}

/** 飞弹命中 */
export function sfxHit(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeNoise(ac, 0.1, 0.12);
  makeOsc(ac, 'sine', 300, 0.1, 0.1);
}

/** 击杀敌人 */
export function sfxKill(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'sine', 600, 0.15, 0.15);
  makeOsc(ac, 'sine', 900, 0.1, 0.1);
}

/** 建造节点 */
export function sfxBuild(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'sine', 440, 0.12, 0.2);
  makeOsc(ac, 'sine', 660, 0.1, 0.15);
}

/** 出售节点 */
export function sfxSell(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'sine', 660, 0.1, 0.15);
  makeOsc(ac, 'sine', 440, 0.12, 0.1);
}

/** 连线创建 */
export function sfxConnect(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'triangle', 520, 0.08, 0.12);
}

/** Tesla 电击 */
export function sfxTesla(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeNoise(ac, 0.06, 0.08);
  makeOsc(ac, 'sawtooth', 150 + Math.random() * 100, 0.05, 0.06);
}

/** 陷阱爆炸 */
export function sfxTrapExplode(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeNoise(ac, 0.25, 0.2);
  makeOsc(ac, 'sine', 100, 0.2, 0.15);
  makeOsc(ac, 'sawtooth', 60, 0.3, 0.1);
}

/** 工厂无人机 */
export function sfxFactory(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'triangle', 350, 0.1, 0.08);
  makeOsc(ac, 'square', 700, 0.06, 0.05);
}

/** 分裂 */
export function sfxSplit(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'sawtooth', 200, 0.15, 0.1);
  makeOsc(ac, 'sine', 500, 0.08, 0.08);
}

/** 干扰者中断连线 */
export function sfxDisrupt(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'square', 120, 0.15, 0.1);
  makeNoise(ac, 0.08, 0.06);
}

/** 节点受击 */
export function sfxNodeHit(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'sine', 200, 0.08, 0.08);
}

/** 游戏结束 */
export function sfxGameOver(): void {
  const ac = ensureCtx();
  if (!ac) return;
  makeOsc(ac, 'sawtooth', 200, 0.5, 0.2);
  makeOsc(ac, 'sawtooth', 150, 0.6, 0.15);
  makeOsc(ac, 'sine', 80, 0.8, 0.1);
}

/** 关卡胜利 */
export function sfxVictory(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    setTimeout(() => {
      const a = ensureCtx();
      if (!a) return;
      makeOsc(a, 'sine', f, 0.3, 0.2);
    }, i * 120);
  });
}

/** 成就解锁音效：上行琶音 */
export function sfxAchievement(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const notes = [880, 1109, 1319]; // A5 C#6 E6
  notes.forEach((f, i) => {
    setTimeout(() => {
      const a = ensureCtx();
      if (!a) return;
      makeOsc(a, 'triangle', f, 0.25, 0.15);
    }, i * 80);
  });
}

/** 能量超载触发音效：上升电子嗡鸣 */
export function sfxOvercharge(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.15);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.15, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
  osc.connect(g);
  g.connect(masterGain!);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.25);
}

// ─── 背景音乐（低频 drone） ─────────────────

let bgOsc1: OscillatorNode | null = null;
let bgOsc2: OscillatorNode | null = null;
let bgGain: GainNode | null = null;

export function startBgm(): void {
  const ac = ensureCtx();
  if (!ac || bgOsc1) return;

  bgGain = ac.createGain();
  bgGain.gain.value = 0.04;
  bgGain.connect(masterGain!);

  bgOsc1 = ac.createOscillator();
  bgOsc1.type = 'sine';
  bgOsc1.frequency.value = 55; // A1
  bgOsc1.connect(bgGain);
  bgOsc1.start();

  bgOsc2 = ac.createOscillator();
  bgOsc2.type = 'triangle';
  bgOsc2.frequency.value = 82.4; // E2
  bgOsc2.connect(bgGain);
  bgOsc2.start();
}

export function stopBgm(): void {
  try {
    bgOsc1?.stop();
    bgOsc2?.stop();
  } catch { /* already stopped */ }
  bgOsc1 = null;
  bgOsc2 = null;
  bgGain = null;
}
