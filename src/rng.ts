// ===== 可复现随机数（Phase B-2 benchmark 基础设施） =====
// 使用 mulberry32：32-bit state、period 2^32、足够覆盖单局游戏所需随机量
// 入口：setSeed(n) 注入种子；rand() 替代 Math.random；getSeed() 读取当前种子

let _seed: number = 0;
let _state: number = 0;

/** mulberry32 核心 */
function mulberry32(): number {
  _state |= 0;
  _state = (_state + 0x6D2B79F5) | 0;
  let t = _state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 设置种子；传 0 表示使用当前时间戳（即"未指定"行为，等价于普通 Math.random 体验） */
export function setSeed(seed: number): void {
  _seed = seed | 0;
  _state = _seed;
}

/** 当前种子（0 表示未注入，rand() 会回退到 Math.random） */
export function getSeed(): number {
  return _seed;
}

/** 获取下一个 [0, 1) 随机数。未注入种子时回退到 Math.random，保持原有手感 */
export function rand(): number {
  if (_seed === 0) return Math.random();
  return mulberry32();
}

/** 从 URL 参数 ?seed= 读取并注入；返回是否成功注入 */
export function initSeedFromURL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('seed');
    if (!raw) return false;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n === 0) return false;
    setSeed(n);
    return true;
  } catch {
    return false;
  }
}
