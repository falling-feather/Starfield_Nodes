#!/usr/bin/env node
// scripts/bench-check.mjs
// Phase B-2 第四轮：CI 回归防护网。
//
// 行为：
//   1) 读 scripts/bench-baseline.json 的 args + expected 数组
//   2) 调用 scripts/bench-batch.mjs 用相同参数跑（写入 _ci.csv/_ci.json 临时产物）
//   3) 读回 _ci.json，按 seed+levelId 配对，比对 deterministic 字段
//   4) 任一字段漂移 → 打印 diff 表格 + 退出码 1
//
// 用法：node scripts/bench-check.mjs [--update] （--update 把当前实跑覆写回 baseline）

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = dirname(__filename);
const repoRoot = resolve(scriptsDir, '..');

const baselinePath = resolve(scriptsDir, 'bench-baseline.json');
const ciOutCsv = resolve(repoRoot, 'bench-ci.csv');
const ciOutJson = resolve(repoRoot, 'bench-ci.json');

const updateMode = process.argv.includes('--update');

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const a = baseline.args;

console.log(`[bench-check] baseline: ${baseline.expected.length} runs (seeds=${a.seeds} levels=${a.levels} waves=${a.waves} speed=${a.speed}${a.nodesMatrix ? ' nodes-matrix=' + a.nodesMatrix : ''})`);

// 直接 spawn node scripts/bench-batch.mjs，绕开 npm run 的输出污染
const isWin = process.platform === 'win32';
const batchArgs = [
  resolve(scriptsDir, 'bench-batch.mjs'),
  '--seeds', a.seeds,
  '--levels', a.levels,
  '--waves', String(a.waves),
  '--speed', String(a.speed),
  '--out', 'bench-ci.csv',
  '--timeout', '120000',
];
if (a.nodesMatrix) batchArgs.push('--nodes-matrix', a.nodesMatrix);
else batchArgs.push('--nodes', a.nodes);

const child = spawn(
  process.execPath,
  batchArgs,
  { cwd: repoRoot, stdio: 'inherit' }
);

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[bench-check] bench-batch exit code = ${code}`);
    process.exit(code ?? 1);
  }

  const actual = JSON.parse(readFileSync(ciOutJson, 'utf8'));
  // 注意：仅比对 RNG/seed 决定的不变量。
  // finalScore / finalEnemyCount 受 wall-clock dt 影响（loop(timestamp) 在 RAF 时序波动下
  // 命中/未命中 1 个敌人都会反映在击杀计数上），不放进 CI 卡点，否则误报刷屏。
  const fields = ['outcome', 'reachedWave', 'totalTicks', 'finalNodeCount'];

  // 索引 actual: pool|seed|level → run（多节点池矩阵必须包含 poolName）
  const idx = new Map();
  for (const r of actual.runs) {
    const pool = r.poolName ?? 'default';
    idx.set(`${pool}|${r.seed}|${r.levelId}`, r);
  }

  if (updateMode) {
    const fresh = baseline.expected.map(e => {
      const pool = e.poolName ?? 'default';
      const r = idx.get(`${pool}|${e.seed}|${e.levelId}`);
      if (!r) return e;
      const out = {};
      if (e.poolName !== undefined) out.poolName = r.poolName ?? pool;
      out.seed = r.seed; out.levelId = r.levelId;
      for (const f of fields) out[f] = r[f];
      return out;
    });
    const next = { ...baseline, expected: fresh };
    writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
    console.log(`[bench-check] --update: baseline overwritten with ${fresh.length} runs`);
    cleanup();
    process.exit(0);
  }

  let drifted = 0;
  const driftRows = [];
  for (const exp of baseline.expected) {
    const pool = exp.poolName ?? 'default';
    const key = `${pool}|${exp.seed}|${exp.levelId}`;
    const got = idx.get(key);
    if (!got) {
      drifted++;
      driftRows.push({ key, field: '*', expected: 'present', actual: 'MISSING' });
      continue;
    }
    for (const f of fields) {
      if (exp[f] !== undefined && got[f] !== exp[f]) {
        drifted++;
        driftRows.push({ key, field: f, expected: exp[f], actual: got[f] });
      }
    }
  }

  if (drifted === 0) {
    console.log(`[bench-check] OK — ${baseline.expected.length} runs all match baseline`);
    cleanup();
    process.exit(0);
  } else {
    console.error(`[bench-check] DRIFT detected (${drifted} field diff)`);
    console.error('pool|seed|level       field            expected         actual');
    console.error('-------------------- ---------------- ---------------- ----------------');
    for (const d of driftRows) {
      console.error(
        `${d.key.padEnd(20)} ${d.field.padEnd(16)} ${String(d.expected).padEnd(16)} ${String(d.actual).padEnd(16)}`
      );
    }
    console.error('');
    console.error('如该差异为故意调整，运行：node scripts/bench-check.mjs --update');
    cleanup();
    process.exit(1);
  }
});

function cleanup() {
  if (process.env.BENCH_KEEP === '1') return; // CI 想保留产物给后续 step / artifact
  for (const p of [ciOutCsv, ciOutJson]) {
    if (existsSync(p)) {
      try { unlinkSync(p); } catch { /* ignore */ }
    }
  }
}
