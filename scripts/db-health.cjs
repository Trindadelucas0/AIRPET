#!/usr/bin/env node
/**
 * Verificacoes agendaveis: conexoes, tamanho do banco, pg_stat_statements (opcional).
 * Exit 1 se algum limiar for violado. Opcional: ALERT_WEBHOOK_URL (POST JSON).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

function numEnv(name, fallback) {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function maybeWebhook(payload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || !String(url).trim()) return;
  try {
    const https = require('node:https');
    const http = require('node:http');
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ source: 'airpet-db-health', ...payload });
    await new Promise((resolve, reject) => {
      const req = lib.request(
        u,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 10000,
        },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (e) {
    console.error('[db-health] webhook falhou:', e.message);
  }
}

async function main() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_DATABASE;
  if (!host || !user || !database) {
    console.error('Defina DB_HOST, DB_USER, DB_DATABASE no .env');
    process.exit(1);
  }

  const pool = new Pool({
    host,
    port: numEnv('DB_PORT', 5432),
    user,
    password: process.env.DB_PASSWORD,
    database,
    max: 2,
  });

  const maxConnRatio = numEnv('DB_HEALTH_MAX_CONN_RATIO', 80) / 100;
  const warnBytes = numEnv('DB_SIZE_WARN_BYTES', 0);
  const slowMeanMs = numEnv('DB_HEALTH_PG_STAT_MEAN_MS', 5000);
  const slowMinCalls = numEnv('DB_HEALTH_PG_STAT_MIN_CALLS', 20);

  let failed = false;
  const violations = [];

  try {
    const ext = await pool.query(
      `SELECT extname FROM pg_extension WHERE extname IN ('postgis')`
    );
    if (ext.rows.length === 0) {
      violations.push('Extensao postgis nao encontrada neste banco.');
      failed = true;
    } else {
      console.log('[db-health] PostGIS: OK');
    }

    const maxR = await pool.query(`SELECT setting::int AS max FROM pg_settings WHERE name = 'max_connections'`);
    const maxConnections = maxR.rows[0]?.max || 100;
    const actR = await pool.query(
      `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`
    );
    const active = actR.rows[0]?.n ?? 0;
    const ratio = active / maxConnections;
    console.log(`[db-health] Conexoes no banco atual: ${active} / ${maxConnections} (${(ratio * 100).toFixed(1)}%)`);
    if (ratio >= maxConnRatio) {
      violations.push(`Conexoes altas: ${active}/${maxConnections} (limiar ${maxConnRatio * 100}%)`);
      failed = true;
    }

    const sizeR = await pool.query(`SELECT pg_database_size(current_database())::bigint AS bytes`);
    const bytes = sizeR.rows[0]?.bytes ?? 0;
    console.log(`[db-health] Tamanho do banco: ${bytes} bytes`);
    if (warnBytes > 0 && bytes >= warnBytes) {
      violations.push(`Tamanho do banco >= ${warnBytes} bytes (${bytes})`);
      failed = true;
    }

    const hasStats = await pool.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements' LIMIT 1`
    );
    if (hasStats.rows.length) {
      const slow = await pool.query(
        `SELECT queryid::text, calls, mean_exec_time, left(query, 120) AS qpreview
         FROM pg_stat_statements
         WHERE calls >= $1 AND mean_exec_time >= $2
         ORDER BY mean_exec_time DESC
         LIMIT 5`,
        [slowMinCalls, slowMeanMs]
      );
      if (slow.rows.length) {
        console.warn('[db-health] Consultas lentas (pg_stat_statements):');
        slow.rows.forEach((r) => {
          console.warn(`  mean=${r.mean_exec_time?.toFixed?.(1) ?? r.mean_exec_time}ms calls=${r.calls} ${r.qpreview}`);
        });
        violations.push(
          `${slow.rows.length} consulta(s) com mean_exec_time >= ${slowMeanMs}ms e calls >= ${slowMinCalls}`
        );
        failed = true;
      } else {
        console.log('[db-health] pg_stat_statements: nenhuma query acima do limiar');
      }
    } else {
      console.log('[db-health] pg_stat_statements: extensao nao instalada (opcional)');
    }
  } catch (e) {
    console.error('[db-health] Erro:', e.message);
    await maybeWebhook({ ok: false, error: e.message });
    await pool.end();
    process.exit(1);
  }

  await pool.end();

  if (failed) {
    console.error('[db-health] FALHA:', violations.join(' | '));
    await maybeWebhook({ ok: false, violations });
    process.exit(1);
  }

  console.log('[db-health] OK');
  process.exit(0);
}

main();
