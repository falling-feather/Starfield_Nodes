#!/usr/bin/env node
// scripts/bench-analyze.mjs
// Phase B-2 第五轮：bench.json 聚合分析脚本。
//
// 用法：
//   node scripts/bench-analyze.mjs --in bench-matrix.json [--out report.md] [--no-perwave]
//
// 输出：
//   - 总览表：每个 pool 的 n / outcome 计数 / avgScore±sd / avgWave±sd / avgTicks
//   - 按 pool × wave 的时序表：每波结束时的 avg score / avg enemyCount / avg elapsedMs（使用 perWave kind=wave_end 样本）
//   - 按 seed 的稳定性表：同一 (pool, seed) 多次跑的 score 漂移（仅当存在重复时打印）

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const out = { in: '', out: '', noPerWave: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]; const v = argv[i + 1];
    if (k === '--in') { out.in = v; i++; }
    else if (k === '--out') { out.out = v; i++; }
    else if (k === '--no-perwave') { out.noPerWave = true; }
    else if (k === '-h' || k === '--help') {
      console.log('Usage: node scripts/bench-analyze.mjs --in <bench.json> [--out report.md] [--no-perwave]');
      process.exit(0);
    }
  }
  if (!out.in) { console.error('--in <bench.json> is required'); process.exit(1); }
  return out;
}

function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}
function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '-'; }

const args = parseArgs(process.argv);
const data = JSON.parse(readFileSync(resolve(args.in), 'utf8'));
const runs = Array.isArray(data.runs) ? data.runs : [];
if (runs.length === 0) { console.error('no runs in input'); process.exit(1); }

// ---------- 按 pool 分组 ----------
const pools = new Map(); // poolName -> runs[]
for (const r of runs) {
  const name = r.poolName ?? 'default';
  if (!pools.has(name)) pools.set(name, []);
  pools.get(name).push(r);
}

const lines = [];
lines.push('# Bench Analyze Report');
lines.push('');
lines.push(`- 输入：\`${args.in}\``);
if (data.args) {
  lines.push(`- 参数：seeds=${data.args.seeds} levels=${data.args.levels} waves=${data.args.waves} speed=${data.args.speed}×`);
  if (data.args.nodesMatrix) lines.push(`- nodes-matrix：\`${data.args.nodesMatrix}\``);
  else if (data.args.nodes) lines.push(`- nodes：\`${data.args.nodes}\``);
}
lines.push(`- 总 runs：${runs.length}（${pools.size} pool）`);
lines.push('');

// ---------- 总览表 ----------
lines.push('## 1. 总览（按 pool 聚合）');
lines.push('');
lines.push('| pool | n | won | gameover | reached_target | error | avgScore ± sd | avgWave ± sd | avgTicks |');
lines.push('|------|--:|----:|---------:|---------------:|------:|--------------:|-------------:|---------:|');
for (const [name, rs] of pools) {
  const ok = rs.filter(r => r.outcome !== 'error');
  const scores = ok.map(r => r.finalScore);
  const waves = ok.map(r => r.reachedWave);
  const ticks = ok.map(r => r.totalTicks);
  const won = rs.filter(r => r.outcome === 'won').length;
  const go = rs.filter(r => r.outcome === 'gameover').length;
  const rt = rs.filter(r => r.outcome === 'reached_target').length;
  const er = rs.filter(r => r.outcome === 'error').length;
  lines.push(`| ${name} | ${rs.length} | ${won} | ${go} | ${rt} | ${er} | ${fmt(mean(scores), 1)} ± ${fmt(stddev(scores), 1)} | ${fmt(mean(waves), 2)} ± ${fmt(stddev(waves), 2)} | ${fmt(mean(ticks), 0)} |`);
}
lines.push('');

// ---------- 按 pool × wave 时序 ----------
if (!args.noPerWave) {
  lines.push('## 2. 时序：按 pool × wave_end 聚合');
  lines.push('');
  for (const [name, rs] of pools) {
    // 收集所有 wave_end 样本（按 wave 编号分组）
    const byWave = new Map(); // wave -> {scores, enemy, elapsed, nodes, kills, built, spent}
    for (const r of rs) {
      if (!Array.isArray(r.perWave)) continue;
      for (const w of r.perWave) {
        if (w.kind !== 'wave_end') continue;
        if (!byWave.has(w.wave)) byWave.set(w.wave, { scores: [], enemy: [], elapsed: [], nodes: [], kills: [], built: [], spent: [] });
        const slot = byWave.get(w.wave);
        slot.scores.push(w.score);
        slot.enemy.push(w.enemyCount);
        slot.elapsed.push(w.elapsedMs);
        slot.nodes.push(w.nodeCount);
        // §25 instrumentation：旧报告无此字段时跳过聚合
        if (typeof w.kills === 'number') slot.kills.push(w.kills);
        if (typeof w.built === 'number') slot.built.push(w.built);
        if (typeof w.spent === 'number') slot.spent.push(w.spent);
      }
    }
    if (byWave.size === 0) continue;
    // 探测样本是否包含 §25 字段
    const hasInstr = [...byWave.values()].some(s => s.kills.length > 0 || s.built.length > 0 || s.spent.length > 0);
    lines.push(`### pool: \`${name}\``);
    lines.push('');
    if (hasInstr) {
      lines.push('| wave | n | avgScore ± sd | avgEnemy | avgNodes | avgKills | avgBuilt | avgSpent | avgElapsedMs |');
      lines.push('|-----:|--:|--------------:|---------:|---------:|---------:|---------:|---------:|-------------:|');
    } else {
      lines.push('| wave | n | avgScore ± sd | avgEnemy | avgNodes | avgElapsedMs |');
      lines.push('|-----:|--:|--------------:|---------:|---------:|-------------:|');
    }
    const sortedWaves = [...byWave.keys()].sort((a, b) => a - b);
    for (const w of sortedWaves) {
      const s = byWave.get(w);
      if (hasInstr) {
        lines.push(`| ${w} | ${s.scores.length} | ${fmt(mean(s.scores), 1)} ± ${fmt(stddev(s.scores), 1)} | ${fmt(mean(s.enemy), 1)} | ${fmt(mean(s.nodes), 1)} | ${fmt(mean(s.kills), 1)} | ${fmt(mean(s.built), 1)} | ${fmt(mean(s.spent), 0)} | ${fmt(mean(s.elapsed), 0)} |`);
      } else {
        lines.push(`| ${w} | ${s.scores.length} | ${fmt(mean(s.scores), 1)} ± ${fmt(stddev(s.scores), 1)} | ${fmt(mean(s.enemy), 1)} | ${fmt(mean(s.nodes), 1)} | ${fmt(mean(s.elapsed), 0)} |`);
      }
    }
    lines.push('');
  }
}

// ---------- 稳定性（同 pool+seed 多次） ----------
const stabilityKey = (r) => `${r.poolName ?? 'default'}|${r.seed}|${r.levelId}`;
const repeatGroups = new Map();
for (const r of runs) {
  const k = stabilityKey(r);
  if (!repeatGroups.has(k)) repeatGroups.set(k, []);
  repeatGroups.get(k).push(r);
}
const repeated = [...repeatGroups.entries()].filter(([, v]) => v.length > 1);
if (repeated.length > 0) {
  lines.push('## 3. 稳定性（同 pool+seed+level 多次重复）');
  lines.push('');
  lines.push('| pool\\|seed\\|level | n | scores | sd | wave 一致 | tick 一致 |');
  lines.push('|-----------------|--:|--------|---:|:--------:|:--------:|');
  for (const [k, rs] of repeated) {
    const scores = rs.map(r => r.finalScore);
    const waves = new Set(rs.map(r => r.reachedWave));
    const ticks = new Set(rs.map(r => r.totalTicks));
    lines.push(`| ${k} | ${rs.length} | ${scores.join(', ')} | ${fmt(stddev(scores), 1)} | ${waves.size === 1 ? '✓' : '✗'} | ${ticks.size === 1 ? '✓' : '✗'} |`);
  }
  lines.push('');
}

// ---------- 输出 ----------
const md = lines.join('\n');
if (args.out) {
  writeFileSync(resolve(args.out), md, 'utf8');
  console.log(`[bench-analyze] wrote ${args.out} (${runs.length} runs, ${pools.size} pools)`);
} else {
  process.stdout.write(md);
}
