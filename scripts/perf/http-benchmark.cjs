#!/usr/bin/env node
/* eslint-disable no-console */
const { performance } = require('node:perf_hooks');

function getArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, i))];
}

function toMs(n) {
  return Number(n.toFixed(2));
}

async function run() {
  const url = getArg('url', '');
  if (!url) {
    console.error('Uso: node scripts/perf/http-benchmark.cjs --url http://localhost:3000/ --connections 20 --durationSec 20');
    process.exit(1);
  }

  const connections = Math.max(parseInt(getArg('connections', '20'), 10) || 20, 1);
  const durationSec = Math.max(parseInt(getArg('durationSec', '20'), 10) || 20, 5);
  const timeoutMs = Math.max(parseInt(getArg('timeoutMs', '10000'), 10) || 10000, 1000);

  const startedAt = performance.now();
  const stopAt = startedAt + durationSec * 1000;
  const durations = [];
  let success = 0;
  let errors = 0;
  let timeouts = 0;
  let completed = 0;

  async function worker() {
    while (performance.now() < stopAt) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const t0 = performance.now();
      try {
        const r = await fetch(url, { method: 'GET', signal: controller.signal });
        const ms = performance.now() - t0;
        durations.push(ms);
        if (r.ok) success += 1;
        else errors += 1;
        completed += 1;
      } catch (err) {
        const ms = performance.now() - t0;
        durations.push(ms);
        completed += 1;
        if (err && err.name === 'AbortError') timeouts += 1;
        else errors += 1;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  await Promise.all(Array.from({ length: connections }, () => worker()));
  const elapsedSec = Math.max((performance.now() - startedAt) / 1000, 0.001);
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = durations.length ? durations.reduce((acc, v) => acc + v, 0) / durations.length : 0;
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const max = sorted.length ? sorted[sorted.length - 1] : 0;

  const out = {
    url,
    connections,
    durationSec: toMs(elapsedSec),
    requests: completed,
    throughputRps: toMs(completed / elapsedSec),
    success,
    errors,
    timeouts,
    avgMs: toMs(avg),
    p95Ms: toMs(p95),
    p99Ms: toMs(p99),
    maxMs: toMs(max),
  };

  console.log(JSON.stringify(out, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
