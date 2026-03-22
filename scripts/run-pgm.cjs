#!/usr/bin/env node
/**
 * Carrega .env, monta DATABASE_URL a partir de DB_* se necessário e delega ao node-pg-migrate.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { spawnSync } = require('child_process');

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim()) return;
  const u = process.env.DB_USER;
  const p = process.env.DB_PASSWORD ?? '';
  const h = process.env.DB_HOST;
  const port = process.env.DB_PORT || 5432;
  const d = process.env.DB_DATABASE;
  if (!u || !h || !d) {
    console.error('Defina DATABASE_URL ou DB_USER, DB_HOST, DB_DATABASE no .env');
    process.exit(1);
  }
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}:${port}/${encodeURIComponent(d)}`;
}

ensureDatabaseUrl();

const pgmBin = path.join(
  path.dirname(require.resolve('node-pg-migrate/package.json')),
  'bin',
  'node-pg-migrate.js'
);
const args = [pgmBin, ...process.argv.slice(2)];
const r = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
