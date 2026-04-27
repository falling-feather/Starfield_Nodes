// ===== 敌人实体系统 =====
import type { Enemy, GameState } from './types';
import { ENEMY_COLORS } from './data/enemies';
import {
  ENEMY_BASE_STATS,
  ENEMY_UNLOCK_WAVE,
  TARGET_WEIGHT_BY_ENEMY,
  getBossStats,
  SPAWN_DIST_MIN,
  SPAWN_DIST_RANDOM,
  BOSS_SPAWN_DIST,
} from './data/spawn';
import { ENEMY_DEATH_REWARDS, DEFAULT_ENEMY_REWARD, RUNTIME } from './data/balance';
import { dist } from './graph';
import { getNebulaSlowFactor } from './graph';
import { hasShieldRepairLink } from './graph';
import { COMBAT } from './data/balance';
import { sfxHit, sfxKill, sfxSplit, sfxDisrupt, sfxNodeHit } from './audio';
import { emitDestructionParticles } from './particles';
import { rand } from './rng';

let enemyIdCounter = 0;

/** 点到线段的距离 */
function pointToSegDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function spawnEnemy(state: GameState, difficultyMult: number = 1): void {
  const wave = state.wave;
  const count = 1 + Math.floor(wave / RUNTIME.enemySpawnCountDivisor);

  // 找到玩家最前线节点的位置，从附近生成敌人
  const aliveNodes = state.nodes.filter(n => n.status !== 'destroyed');
  const spawnDist = SPAWN_DIST_MIN + rand() * SPAWN_DIST_RANDOM;

  for (let i = 0; i < count; i++) {
    const enemy = createEnemy(state, wave, aliveNodes, spawnDist, difficultyMult);
    state.enemies.push(enemy);
  }
}

export function spawnBoss(state: GameState, difficultyMult: number = 1): void {
  const aliveNodes = state.nodes.filter(n => n.status !== 'destroyed');
  const spawnDist = BOSS_SPAWN_DIST;
  const wave = state.wave;

  let x: number, y: number;
  if (aliveNodes.length > 0) {
    const target = aliveNodes[Math.floor(rand() * aliveNodes.length)];
    const angle = rand() * Math.PI * 2;
    x = target.x + Math.cos(angle) * spawnDist;
    y = target.y + Math.sin(angle) * spawnDist;
    x = Math.max(-20, Math.min(state.worldWidth + 20, x));
    y = Math.max(-20, Math.min(state.worldHeight + 20, y));
  } else {
    x = state.worldWidth / 2;
    y = -50;
  }

  const stats = getBossStats(wave);
  const hp = stats.hp * difficultyMult;
  const boss: Enemy = {
    id: `enemy_${enemyIdCounter++}`,
    x, y,
    hp,
    maxHp: hp,
    speed: stats.speed,
    damage: stats.damage * difficultyMult,
    targetNodeId: null,
    type: 'boss',
    radius: stats.radius,
    teleportCooldown: 0,
    hitFlash: 0,
    damageReduction: 0,
  };
  state.enemies.push(boss);
}

function createEnemy(state: GameState, wave: number, aliveNodes: typeof state.nodes, spawnDist: number, difficultyMult: number): Enemy {
  // 在玩家节点附近的随机方向生成
  let x: number, y: number;
  if (aliveNodes.length > 0) {
    const target = aliveNodes[Math.floor(rand() * aliveNodes.length)];
    const angle = rand() * Math.PI * 2;
    x = target.x + Math.cos(angle) * spawnDist;
    y = target.y + Math.sin(angle) * spawnDist;
    // 限制在世界范围内
    x = Math.max(-20, Math.min(state.worldWidth + 20, x));
    y = Math.max(-20, Math.min(state.worldHeight + 20, y));
  } else {
    const ww = state.worldWidth;
    const wh = state.worldHeight;
    const side = Math.floor(rand() * 4);
    switch (side) {
      case 0: x = rand() * ww; y = -20; break;
      case 1: x = ww + 20; y = rand() * wh; break;
      case 2: x = rand() * ww; y = wh + 20; break;
      default: x = -20; y = rand() * wh; break;
    }
  }

  // 根据波次组装可生成的敌人池：基础类型始终存在，其余按解锁波次过滤
  const baseTypes: Enemy['type'][] = ['scout', 'heavy', 'swarm'];
  const unlockableTypes = (Object.keys(ENEMY_UNLOCK_WAVE) as Enemy['type'][]).filter(
    t => wave >= (ENEMY_UNLOCK_WAVE[t] ?? 0),
  );
  const pool = [...baseTypes, ...unlockableTypes];
  const type = wave < 3 ? 'scout' : pool[Math.floor(rand() * pool.length)];

  const stats = ENEMY_BASE_STATS[type as Exclude<Enemy['type'], 'boss'>];
  const hp = (stats.hp + wave * 5) * difficultyMult;
  return {
    id: `enemy_${enemyIdCounter++}`,
    x, y,
    hp,
    maxHp: hp,
    speed: stats.speed + wave * 0.05,
    damage: (stats.damage + wave * 2) * difficultyMult,
    targetNodeId: null,
    type,
    radius: stats.radius,
    teleportCooldown: 0,
    hitFlash: 0,
    damageReduction: 0,
  };
}

// TARGET_WEIGHT_BY_ENEMY 已迁移至 src/data/spawn.ts

export function updateEnemies(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    // 按敌人类型权重寻找有效距离最近的节点
    const weights = TARGET_WEIGHT_BY_ENEMY[enemy.type] ?? {};
    let closestNode: { id: string; x: number; y: number; d: number } | null = null;
    for (const node of state.nodes) {
      if (node.status === 'destroyed') continue;
      if (node.owner === 'neutral') continue;
      const rawDist = dist(enemy, node);
      const weight = weights[node.type] ?? 1;
      const effectiveDist = rawDist * weight;
      if (!closestNode || effectiveDist < closestNode.d) {
        closestNode = { id: node.id, x: node.x, y: node.y, d: effectiveDist };
      }
    }

    if (closestNode) {
      enemy.targetNodeId = closestNode.id;
      // 向目标移动
      const dx = closestNode.x - enemy.x;
      const dy = closestNode.y - enemy.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d > 5) {
        // 星云减速
        const nebulaSlow = getNebulaSlowFactor(enemy.x, enemy.y, state);
        enemy.x += (dx / d) * enemy.speed * nebulaSlow * dt * 60;
        enemy.y += (dy / d) * enemy.speed * nebulaSlow * dt * 60;
      }

      // 到达节点，造成伤害
      const targetNode = state.nodes.find(n => n.id === closestNode!.id);
      if (targetNode && d < targetNode.radius + enemy.radius) {
        let dmg = enemy.damage * dt;
        // 联动：shield 直连同方 repair 时受伤减免
        if (targetNode.type === 'shield' && hasShieldRepairLink(state, targetNode)) {
          dmg *= (1 - COMBAT.shield.synergyRepairDamageReduce);
        }
        targetNode.hp -= dmg;
        targetNode.hitFlash = 1;
        if (rand() < 0.02) sfxNodeHit(); // 低频触发，避免噪音
        if (targetNode.hp <= targetNode.maxHp * 0.3) {
          targetNode.status = 'damaged';
        }
        if (targetNode.hp <= 0) {
          targetNode.hp = 0;
          targetNode.status = 'destroyed';
          targetNode.currentEnergy = 0;
          emitDestructionParticles(state, targetNode.x, targetNode.y, targetNode.glowColor);
          // 屏幕震动：核心摧毁更强
          state.screenShake = targetNode.type === 'core' ? 12 : 6;
          // 所有核心被摧毁时游戏结束
          if (targetNode.type === 'core') {
            const remainingCores = state.nodes.filter(
              n => n.type === 'core' && n.status !== 'destroyed'
            );
            if (remainingCores.length === 0) {
              state.gameOver = true;
            }
          }
        }
      }
    }
  }

  // 处理飞弹命中
  updateProjectiles(state, dt);

  // 虫洞传送
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.teleportCooldown > 0) {
      enemy.teleportCooldown -= dt;
      if (enemy.teleportCooldown < 0) enemy.teleportCooldown = 0;
      continue;
    }
    for (const zone of state.terrainZones) {
      if (zone.type !== 'wormhole' || !zone.linkedId) continue;
      if (dist(enemy, zone) <= zone.radius) {
        const linked = state.terrainZones.find(z => z.id === zone.linkedId);
        if (linked) {
          // 传送到配对虫洞外侧，避免立刻再次触发
          const angle = rand() * Math.PI * 2;
          enemy.x = linked.x + Math.cos(angle) * (linked.radius + 10);
          enemy.y = linked.y + Math.sin(angle) * (linked.radius + 10);
          enemy.teleportCooldown = 2; // 2秒传送免疫
          break;
        }
      }
    }
  }

  // 干扰者效果：经过连线时切断链路
  for (const enemy of state.enemies) {
    if (enemy.type !== 'disruptor' || enemy.hp <= 0) continue;
    for (const edge of state.edges) {
      const s = state.nodes.find(n => n.id === edge.sourceId);
      const t = state.nodes.find(n => n.id === edge.targetId);
      if (!s || !t) continue;
      if (pointToSegDist(enemy, s, t) < 30) {
        if (edge.disruptedTimer <= 0) sfxDisrupt(); // 仅首次触发音效
        edge.disruptedTimer = 3; // 中断 3 秒
      }
    }
  }

  // 边中断计时衰减
  for (const edge of state.edges) {
    if (edge.disruptedTimer > 0) {
      edge.disruptedTimer -= dt;
      if (edge.disruptedTimer < 0) edge.disruptedTimer = 0;
    }
  }

  // 治疗者效果：周期性治疗周围 120 范围内的其他敌人
  for (const enemy of state.enemies) {
    if (enemy.type !== 'healer' || enemy.hp <= 0) continue;
    // 每 60 tick (~1秒) 治疗一次
    if (state.tick % 60 !== 0) continue;
    const healRange = 120;
    const healAmount = 8 + state.wave * 1.5;
    for (const other of state.enemies) {
      if (other === enemy || other.hp <= 0) continue;
      if (dist(enemy, other) <= healRange) {
        other.hp = Math.min(other.maxHp, other.hp + healAmount);
      }
    }
  }

  // 分裂虫死亡后分裂
  const splitSpawns: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.type === 'splitter' && enemy.hp <= 0) {
      sfxSplit();
      const count = 2 + (rand() < 0.3 ? 1 : 0); // 2~3 个
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rand() * 0.5;
        const spd = 2.0 + state.wave * 0.05;
        const childHp = Math.max(10, enemy.maxHp * 0.25);
        splitSpawns.push({
          id: `enemy_${enemyIdCounter++}`,
          x: enemy.x + Math.cos(angle) * 15,
          y: enemy.y + Math.sin(angle) * 15,
          hp: childHp,
          maxHp: childHp,
          speed: spd,
          damage: Math.max(3, enemy.damage * 0.3),
          targetNodeId: null,
          type: 'swarm', // 分裂子体是 swarm 类型
          radius: 5,
          teleportCooldown: 0,
          hitFlash: 0,
        });
      }
    }
  }

  // 死亡敌人爆炸粒子
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      const color = ENEMY_COLORS[enemy.type] ?? '#ff3333';
      const count = enemy.type === 'boss' ? 16 : 8;
      for (let j = 0; j < count; j++) {
        const angle = rand() * Math.PI * 2;
        const speed = 1.5 + rand() * 4;
        state.particles.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.4 + rand() * 0.4,
          maxLife: 0.8,
          color,
          size: 2 + rand() * 3,
        });
      }
    }
  }

  // 清除死亡敌人
  state.enemies = state.enemies.filter(e => e.hp > 0);

  // 添加分裂子体
  if (splitSpawns.length > 0) {
    state.enemies.push(...splitSpawns);
  }
}

function updateProjectiles(state: GameState, dt: number): void {
  const toRemove: number[] = [];

  for (let i = 0; i < state.projectiles.length; i++) {
    const proj = state.projectiles[i];
    const target = state.enemies.find(e => e.id === proj.targetId);

    if (!target) {
      toRemove.push(i);
      continue;
    }

    const dx = target.x - proj.x;
    const dy = target.y - proj.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < target.radius + 4) {
      // 命中
      target.hp -= proj.damage;
      target.hitFlash = 1;
      sfxHit();
      toRemove.push(i);

      // 爆炸粒子
      for (let j = 0; j < 6; j++) {
        const angle = rand() * Math.PI * 2;
        const speed = 1 + rand() * 3;
        state.particles.push({
          x: proj.x,
          y: proj.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.4 + rand() * 0.3,
          maxLife: 0.7,
          color: proj.color,
          size: 2 + rand() * 2,
        });
      }

      // 击杀奖励
      if (target.hp <= 0) {
        sfxKill();
        const reward = ENEMY_DEATH_REWARDS[target.type] ?? DEFAULT_ENEMY_REWARD;
        state.score += reward.score;
        state.resources += reward.res;
        state.crystals += reward.crystal;
      }
    } else {
      // 移动飞弹
      proj.x += (dx / d) * proj.speed * dt * 60;
      proj.y += (dy / d) * proj.speed * dt * 60;
    }
  }

  // 逆序删除
  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.projectiles.splice(toRemove[i], 1);
  }
}
