// ===== 存档校验（Phase B-3 防作弊） =====
// 非密码学场景：cyrb53（53-bit hash）+ 内嵌 SECRET 拼接。
// 目标：阻挡 99% 通过浏览器 devtools 直接改 localStorage 的玩家；
// 不防专业逆向（前端无法防止），但能让"按图索骥的修改器"立即失效。

const SECRET = 'sf-nodes-v1-2026:falling-feather';

/** cyrb53 — 快速、低碰撞的 53-bit 非加密哈希 */
export function cyrb53(str: string, seed: number = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const result = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return result.toString(16).padStart(14, '0');
}

/** 对存档负载（已序列化的 JSON 字符串）签名 */
export function signPayload(payload: string): string {
  return cyrb53(payload + SECRET, 0xc0ffee);
}

/** 校验：比对签名是否一致 */
export function verifyPayload(payload: string, sig: string): boolean {
  return signPayload(payload) === sig;
}

// ===== 关键字段二级签名（Phase E：挡住手工拼装单条 profile） =====
// 单独的 SECRET2 + seed，避免与外层信封共享同一字节流，防止"信封 sig 即字段 sig"误判
const SECRET2 = 'sf-nodes-profile-v1:per-record';

/** 对单个 profile 内容（不含其自身 __sig 字段）签名 */
export function signProfile(profilePayload: string): string {
  return cyrb53(profilePayload + SECRET2, 0xbadcafe);
}

export function verifyProfile(profilePayload: string, sig: string): boolean {
  return signProfile(profilePayload) === sig;
}
