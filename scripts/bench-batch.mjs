#!/usr/bin/env node
// scripts/bench-batch.mjs
// Phase B-2 第三轮：Node 端批量 benchmark。
//
// 用法：
//   node scripts/bench-batch.mjs --seeds 1,2,3 --levels 1 --waves 10 --speed 8 \
//        --nodes "energy,turret,mine,shield,relay" --out bench.csv
//
//   # 多节点池矩阵（每组 pool × seed × level 各跑一次）：
//   node scripts/bench-batch.mjs --seeds 1,2,3 --levels 1 --waves 10 --speed 8 \
//        --nodes-matrix "full=energy,turret,mine,shield,relay;noMine=energy,turret,shield,relay;turretOnly=energy,turret" \
//        --out bench-matrix.csv
//
// 行为：
//   1) 启动 vite preview 子进程（自动选取空闲端口）
//   2) 用 Playwright headless Chromium 依次访问 ?bench=1&seed=...&level=...&waves=...&speed=...&nodes=...
//   3) 等待 window.__benchResult 就绪后采集
//   4) 每条结果写入 CSV（外加一份 .json 留 perWave 完整数据）
//   5) 关闭浏览器与 preview，输出汇总
//
// 仅依赖 devDependencies 中的 playwright；无需用户额外配置。

import { chromium } from 'playwright';
import { preview as vitePreview } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------- argv ----------
function parseArgs(argv) {
  const out = {
    seeds: '1',
    levels: '1',
    waves: 10,
    speed: 8,
    nodes: 'energy,turret,mine,shield,relay',
    nodesMatrix: '',
    out: 'bench.csv',
    timeoutMs: 60000,
    autoUpgrade: false,
    strategy: 'idle',
    offline: false,
    abAutoUpgrade: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--seeds') {
      out.seeds = v;
      i++;
    } else if (k === '--levels') {
      out.levels = v;
      i++;
    } else if (k === '--waves') {
      out.waves = parseInt(v, 10) || 10;
      i++;
    } else if (k === '--speed') {
      out.speed = parseFloat(v) || 8;
      i++;
    } else if (k === '--nodes') {
      out.nodes = v;
      i++;
    } else if (k === '--nodes-matrix') {
      out.nodesMatrix = v;
      i++;
    } else if (k === '--out') {
      out.out = v;
      i++;
    } else if (k === '--timeout') {
      out.timeoutMs = parseInt(v, 10) || 60000;
      i++;
    } else if (k === '--offline') {
      out.offline = true;
    } else if (k === '--strategy') {
      out.strategy = v;
      i++;
    } else if (k === '--auto-upgrade') {
      out.autoUpgrade = true;
    } else if (k === '--ab-autoupgrade') {
      out.abAutoUpgrade = true;
    } else if (k === '-h' || k === '--help') {
      console.log(
        'Usage: node scripts/bench-batch.mjs [--seeds 1,2,3] [--levels 1] [--waves 10] [--speed 8] [--nodes a,b,c | --nodes-matrix "name1=a,b;name2=a,b,c"] [--out bench.csv] [--timeout 60000] [--auto-upgrade] [--ab-autoupgrade]',
      );
      process.exit(0);
    }
  }
  return out;
}

// 把 --nodes / --nodes-matrix 解析成 [{name, nodes}]
function parseNodePools(args) {
  if (args.nodesMatrix && args.nodesMatrix.trim()) {
    const groups = args.nodesMatrix
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    return groups.map((g, i) => {
      const eq = g.indexOf('=');
      if (eq > 0) {
        return { name: g.slice(0, eq).trim(), nodes: g.slice(eq + 1).trim() };
      }
      return { name: `pool${i + 1}`, nodes: g };
    });
  }
  return [{ name: 'default', nodes: args.nodes }];
}

const args = parseArgs(process.argv);
const seeds = args.seeds
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => !Number.isNaN(n));
const levels = args.levels
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => !Number.isNaN(n));

const nodePools = parseNodePools(args);

if (seeds.length === 0 || levels.length === 0 || nodePools.length === 0) {
  console.error('[bench-batch] empty seeds / levels / nodePools');
  process.exit(1);
}

const totalRuns = seeds.length * levels.length * nodePools.length;
console.log(
  `[bench-batch] plan: ${seeds.length} seeds × ${levels.length} levels × ${nodePools.length} pools = ${totalRuns} runs, waves=${args.waves} speed=${args.speed}×`,
);
for (const p of nodePools) console.log(`  pool[${p.name}] = ${p.nodes}`);

// ---------- preview server ----------
const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), '..');

// Use the installed Vite API: no shared fixed port, shell or orphan child process.
const preview = args.offline
  ? null
  : await vitePreview({
      root: repoRoot,
      logLevel: 'error',
      preview: { host: '127.0.0.1', port: 0, strictPort: false },
    });
const address = preview?.httpServer.address();
if (!args.offline && (!address || typeof address === 'string'))
  throw new Error('preview did not provide a TCP address');
const previewUrl = args.offline
  ? pathToFileURL(resolve(repoRoot, 'dist/星域节点.html')).href
  : `http://127.0.0.1:${address.port}/`;
let activeBrowser;

// ---------- main ----------
async function main() {
  console.log(`[bench-batch] preview ready at ${previewUrl}`);

  const browser = (activeBrowser = await chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const results = [];
  let runIdx = 0;
  // §30：--ab-autoupgrade 下每 (seed,level,pool) 跑两次（autoUpgrade=0 和 =1）
  const auModes = args.abAutoUpgrade ? [false, true] : [args.autoUpgrade];
  const totalRunsActual = totalRuns * auModes.length;
  if (args.abAutoUpgrade)
    console.log(
      `[bench-batch] AB mode: ×${auModes.length} runs (autoUpgrade=off,on) = ${totalRunsActual} total`,
    );
  for (const levelId of levels) {
    for (const pool of nodePools) {
      for (const seed of seeds) {
        for (const au of auModes) {
          runIdx++;
          const url = `${previewUrl}?bench=1&seed=${seed}&level=${levelId}&waves=${args.waves}&speed=${args.speed}&nodes=${encodeURIComponent(pool.nodes)}&strategy=${encodeURIComponent(args.strategy)}${au ? '&autoUpgrade=1' : ''}`;
          const page = await ctx.newPage();
          page.on('console', (msg) => {
            const t = msg.type();
            if (t === 'error' || t === 'warning') {
              console.log(`  [page:${t}] ${msg.text()}`);
            }
          });
          const runtimeErrors = [];
          page.on('pageerror', (err) => {
            runtimeErrors.push(err.message);
            console.error(`  [page:pageerror] ${err.message}`);
          });
          const t0 = Date.now();
          try {
            await page.goto(url, { waitUntil: 'load' });
            const result = await page.waitForFunction(
              () => /** @type {any} */ (window).__benchResult,
              null,
              { timeout: args.timeoutMs },
            );
            const data = await result.jsonValue();
            if (runtimeErrors.length) throw new Error(runtimeErrors.join('; '));
            data.poolName = pool.name;
            data.nodes = pool.nodes;
            data.autoUpgrade = au ? 1 : 0;
            const wallMs = Date.now() - t0;
            console.log(
              `[bench-batch] (${runIdx}/${totalRunsActual}) pool=${pool.name} seed=${seed} level=${levelId} au=${au ? 1 : 0} → ${data.outcome} wave=${data.reachedWave} score=${data.finalScore} ticks=${data.totalTicks} wall=${wallMs}ms`,
            );
            results.push(data);
          } catch (err) {
            console.error(
              `[bench-batch] pool=${pool.name} seed=${seed} level=${levelId} au=${au ? 1 : 0} FAILED: ${err.message}`,
            );
            results.push({
              seed,
              levelId,
              targetWaves: args.waves,
              speed: args.speed,
              poolName: pool.name,
              nodes: pool.nodes,
              autoUpgrade: au ? 1 : 0,
              reachedWave: -1,
              finalScore: -1,
              totalTicks: -1,
              finalNodeCount: -1,
              finalEnemyCount: -1,
              outcome: 'error',
              elapsedMs: -1,
              perWave: [],
              error: err.message,
            });
          } finally {
            await page.close();
          }
        }
      }
    }
  }

  await browser.close();

  // ---------- outputs ----------
  const outPath = resolve(repoRoot, args.out);
  mkdirSync(dirname(outPath), { recursive: true });
  const csvHeader =
    'poolName,seed,levelId,targetWaves,speed,autoUpgrade,reachedWave,finalScore,totalTicks,finalNodeCount,finalEnemyCount,outcome,elapsedMs';
  const csvLines = [csvHeader];
  for (const r of results) {
    csvLines.push(
      [
        r.poolName ?? 'default',
        r.seed,
        r.levelId,
        r.targetWaves,
        r.speed,
        r.autoUpgrade ?? 0,
        r.reachedWave,
        r.finalScore,
        r.totalTicks,
        r.finalNodeCount,
        r.finalEnemyCount,
        r.outcome,
        r.elapsedMs,
      ].join(','),
    );
  }
  writeFileSync(outPath, csvLines.join('\n') + '\n', 'utf8');

  const jsonPath = outPath.replace(/\.csv$/i, '') + '.json';
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        args,
        runs: results,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`[bench-batch] CSV  → ${outPath}`);
  console.log(`[bench-batch] JSON → ${jsonPath}`);

  if (results.some((result) => result.outcome === 'error')) process.exitCode = 1;

  // 简易聚合（按 pool 分组）
  const ok = results.filter((r) => r.outcome !== 'error');
  if (ok.length) {
    const avgScore = (ok.reduce((s, r) => s + r.finalScore, 0) / ok.length).toFixed(1);
    const avgWave = (ok.reduce((s, r) => s + r.reachedWave, 0) / ok.length).toFixed(2);
    const wonCount = ok.filter((r) => r.outcome === 'won').length;
    const goCount = ok.filter((r) => r.outcome === 'gameover').length;
    const rtCount = ok.filter((r) => r.outcome === 'reached_target').length;
    console.log(
      `[bench-batch] aggregate: avgScore=${avgScore} avgWave=${avgWave} won=${wonCount} gameover=${goCount} reached_target=${rtCount} (n=${ok.length})`,
    );

    if (nodePools.length > 1) {
      console.log('[bench-batch] per-pool aggregate:');
      for (const pool of nodePools) {
        const sub = ok.filter((r) => r.poolName === pool.name);
        if (!sub.length) continue;
        const sAvgScore = (sub.reduce((s, r) => s + r.finalScore, 0) / sub.length).toFixed(1);
        const sAvgWave = (sub.reduce((s, r) => s + r.reachedWave, 0) / sub.length).toFixed(2);
        const sWon = sub.filter((r) => r.outcome === 'won').length;
        const sGo = sub.filter((r) => r.outcome === 'gameover').length;
        const sRt = sub.filter((r) => r.outcome === 'reached_target').length;
        console.log(
          `  [${pool.name.padEnd(12)}] avgScore=${sAvgScore.padStart(6)} avgWave=${sAvgWave} won=${sWon} gameover=${sGo} reached_target=${sRt} (n=${sub.length})`,
        );
      }
    }

    // §30 · AB 模式：并排 autoUpgrade=0 / =1 对比表
    if (args.abAutoUpgrade) {
      console.log('[bench-batch] AB autoUpgrade aggregate (off vs on):');
      const groups = (k) => ok.filter((r) => (r.autoUpgrade ?? 0) === k);
      const fmt = (arr) => {
        if (!arr.length) return 'n=0';
        const s = (arr.reduce((a, r) => a + r.finalScore, 0) / arr.length).toFixed(1);
        const w = (arr.reduce((a, r) => a + r.reachedWave, 0) / arr.length).toFixed(2);
        const won = arr.filter((r) => r.outcome === 'won').length;
        return `n=${arr.length} avgScore=${s.padStart(6)} avgWave=${w} won=${won}`;
      };
      console.log(`  [autoUpgrade=off] ${fmt(groups(0))}`);
      console.log(`  [autoUpgrade=on ] ${fmt(groups(1))}`);
      for (const pool of nodePools) {
        const off = ok.filter((r) => r.poolName === pool.name && (r.autoUpgrade ?? 0) === 0);
        const on = ok.filter((r) => r.poolName === pool.name && (r.autoUpgrade ?? 0) === 1);
        if (!off.length && !on.length) continue;
        console.log(`  [${pool.name.padEnd(12)}] off:${fmt(off)} | on:${fmt(on)}`);
      }
    }

    // §32 · nodeStats 聚合：evolved 数 + level 分布（仅有 nodeStats 字段的 runs）
    const withStats = ok.filter((r) => r.nodeStats);
    if (withStats.length) {
      console.log('[bench-batch] nodeStats aggregate (avg per run):');
      const aggGroup = (arr, label) => {
        if (!arr.length) return;
        const avgEv = {};
        const avgLv = {};
        for (const r of arr) {
          for (const [t, c] of Object.entries(r.nodeStats.evolvedByType ?? {})) {
            avgEv[t] = (avgEv[t] ?? 0) + c;
          }
          for (const [lv, c] of Object.entries(r.nodeStats.levelDist ?? {})) {
            avgLv[lv] = (avgLv[lv] ?? 0) + c;
          }
        }
        const evStr =
          Object.entries(avgEv)
            .map(([t, c]) => `${t}=${(c / arr.length).toFixed(2)}`)
            .join(' ') || '(none)';
        const lvStr = ['1', '2', '3', '4', '5']
          .map((lv) => `L${lv}=${((avgLv[lv] ?? 0) / arr.length).toFixed(1)}`)
          .join(' ');
        console.log(`  [${label.padEnd(18)}] evolved: ${evStr}`);
        console.log(`  [${label.padEnd(18)}] levelDist: ${lvStr} (n=${arr.length})`);
      };
      if (args.abAutoUpgrade) {
        aggGroup(
          withStats.filter((r) => (r.autoUpgrade ?? 0) === 0),
          'autoUpgrade=off',
        );
        aggGroup(
          withStats.filter((r) => (r.autoUpgrade ?? 0) === 1),
          'autoUpgrade=on',
        );
      } else {
        aggGroup(withStats, 'all');
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activeBrowser?.isConnected()) await activeBrowser.close();
    if (preview) {
      preview.httpServer.closeAllConnections();
      await new Promise((resolve, reject) =>
        preview.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
