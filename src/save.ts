// ===== 存档系统 =====
import { signPayload, verifyPayload, signProfile } from './save-sig';

export interface SaveProfile {
  name: string;
  createdAt: number;
  lastPlayed: number;
  stats: {
    highScore: number;
    highWave: number;
    totalGamesPlayed: number;
    totalEnemiesKilled: number;
    totalNodesBuilt: number;
  };
  /** 解锁的科技 ID（跨局保持） */
  unlockedTechs: string[];
  /** 当前关卡进度 */
  currentLevel: number;
  /** 已通关的关卡ID列表 */
  clearedLevels: number[];
  /** 已解锁的成就ID列表 */
  unlockedAchievements: string[];
  /** V1.1.7：已发现的联动 id 列表（跨局永久） */
  discoveredSynergies?: string[];
  /** Phase E: 二级签名（仅在序列化后出现，运行期不使用） */
  __sig?: string;
}

/** 计算 profile 的二级签名（去除 __sig 后序列化） */
function computeProfileSig(p: SaveProfile): string {
  const { __sig: _omit, ...rest } = p;
  void _omit;
  return signProfile(JSON.stringify(rest));
}

const STORAGE_KEY = 'starfield_nodes_profiles';
const ACTIVE_KEY = 'starfield_nodes_active';

/** 信封格式：{ data: SaveProfile[], sig: string }；老格式为裸数组 */
interface SaveEnvelope {
  data: SaveProfile[];
  sig: string;
}

/** 存档篡改/损坏时的轻量回调（main.ts 接管时可显示提示） */
let tamperHandler: ((reason: 'invalid_sig' | 'parse_error') => void) | null = null;
export function setTamperHandler(fn: (reason: 'invalid_sig' | 'parse_error') => void): void {
  tamperHandler = fn;
}

export function loadProfiles(): SaveProfile[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[save] JSON parse error, discarding storage');
    tamperHandler?.('parse_error');
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
  // 老格式：裸数组 → 一次性升级为信封
  if (Array.isArray(parsed)) {
    const arr = parsed as SaveProfile[];
    saveProfiles(arr); // 立即重写为带签名的信封
    return arr;
  }
  // 新格式：信封
  if (parsed && typeof parsed === 'object' && 'data' in parsed && 'sig' in parsed) {
    const env = parsed as SaveEnvelope;
    const payload = JSON.stringify(env.data);
    if (!verifyPayload(payload, env.sig)) {
      console.warn('[save] envelope signature mismatch, discarding storage');
      tamperHandler?.('invalid_sig');
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    // Phase E: 逐个 profile 验证 __sig；缺失视为老格式（允许，下次保存时补上）
    const verified: SaveProfile[] = [];
    let dropped = 0;
    let needRewrite = false;
    for (const p of env.data) {
      if (typeof p.__sig === 'string') {
        const expected = computeProfileSig(p);
        if (expected === p.__sig) {
          verified.push(p);
        } else {
          console.warn(`[save] profile "${p.name}" __sig mismatch, dropped`);
          dropped++;
        }
      } else {
        // 老格式（信封升级后首次读入）
        verified.push(p);
        needRewrite = true;
      }
    }
    if (dropped > 0) {
      tamperHandler?.('invalid_sig');
      saveProfiles(verified); // 重写去掉丢弃项
    } else if (needRewrite) {
      saveProfiles(verified); // 补上 __sig
    }
    return verified;
  }
  console.warn('[save] unknown format, discarding');
  tamperHandler?.('parse_error');
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

export function saveProfiles(profiles: SaveProfile[]): void {
  // Phase E: 为每个 profile 补/重算 __sig
  const signed: SaveProfile[] = profiles.map((p) => {
    const { __sig: _drop, ...rest } = p;
    void _drop;
    return { ...rest, __sig: signProfile(JSON.stringify(rest)) } as SaveProfile;
  });
  const payload = JSON.stringify(signed);
  const env: SaveEnvelope = { data: signed, sig: signPayload(payload) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
}

export function getActiveProfileName(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProfileName(name: string): void {
  localStorage.setItem(ACTIVE_KEY, name);
}

export function createProfile(name: string): SaveProfile {
  const profile: SaveProfile = {
    name,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    stats: {
      highScore: 0,
      highWave: 0,
      totalGamesPlayed: 0,
      totalEnemiesKilled: 0,
      totalNodesBuilt: 0,
    },
    unlockedTechs: [],
    currentLevel: 1,
    clearedLevels: [],
    unlockedAchievements: [],
    discoveredSynergies: [],
  };
  return profile;
}

export function updateProfileStats(
  profile: SaveProfile,
  score: number,
  wave: number,
  enemiesKilled: number,
  nodesBuilt: number,
): void {
  profile.lastPlayed = Date.now();
  profile.stats.totalGamesPlayed++;
  profile.stats.totalEnemiesKilled += enemiesKilled;
  profile.stats.totalNodesBuilt += nodesBuilt;
  if (score > profile.stats.highScore) profile.stats.highScore = score;
  if (wave > profile.stats.highWave) profile.stats.highWave = wave;
}

export function saveProfile(profile: SaveProfile): void {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.name === profile.name);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  saveProfiles(profiles);
}

export function deleteProfile(name: string): void {
  const profiles = loadProfiles().filter(p => p.name !== name);
  saveProfiles(profiles);
  const active = getActiveProfileName();
  if (active === name) {
    localStorage.removeItem(ACTIVE_KEY);
  }
}
