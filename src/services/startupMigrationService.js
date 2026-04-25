const path = require('path');
const { spawnSync } = require('child_process');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function parseMode(rawMode) {
  const clean = String(rawMode || 'baseline+pgm').trim().toLowerCase();
  if (!clean) return new Set(['baseline', 'pgm']);
  return new Set(clean.split('+').map((x) => x.trim()).filter(Boolean));
}

async function runBaselineReconciliations() {
  const startedAt = Date.now();
  const statements = [
    `ALTER TABLE IF EXISTS pets_perdidos
      ADD COLUMN IF NOT EXISTS ciclo_alerta INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE IF EXISTS pets_perdidos
      ADD COLUMN IF NOT EXISTS last_level_changed_at TIMESTAMPTZ`,
    `ALTER TABLE IF EXISTS pets_perdidos
      ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ`,
    /* pet_status_history — auditoria de mudanças de status (perdido/seguro) */
    `CREATE TABLE IF NOT EXISTS pet_status_history (
      id          BIGSERIAL PRIMARY KEY,
      pet_id      INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      old_status  VARCHAR(20),
      new_status  VARCHAR(20) NOT NULL,
      descricao   TEXT,
      latitude    NUMERIC(10,6),
      longitude   NUMERIC(10,6),
      recompensa  VARCHAR(80),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pet_status_history_pet_at
      ON pet_status_history(pet_id, created_at DESC)`,
    /* pet_tracking_events — event store unificado de rastreamento */
    `CREATE TABLE IF NOT EXISTS pet_tracking_events (
      id              BIGSERIAL PRIMARY KEY,
      pet_id          INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      event_type      VARCHAR(40) NOT NULL,
      source          VARCHAR(30) NOT NULL DEFAULT 'nfc',
      latitude        NUMERIC(10,6),
      longitude       NUMERIC(10,6),
      cidade          VARCHAR(120),
      confidence      SMALLINT DEFAULT 100,
      visibility      VARCHAR(20) NOT NULL DEFAULT 'owner',
      metadata        JSONB,
      event_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pet_tracking_events_pet_at
      ON pet_tracking_events(pet_id, event_at DESC)`,
  ];

  let ok = 0;
  for (const sql of statements) {
    // Reconciliação rápida de colunas críticas usadas pelo scheduler no boot.
    await pool.query(sql);
    ok += 1;
  }

  return {
    fase: 'baseline',
    total: statements.length,
    ok,
    erros: 0,
    elapsedMs: Date.now() - startedAt,
  };
}

function runPgmMigrations() {
  const startedAt = Date.now();
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'run-pgm.cjs');
  const result = spawnSync(process.execPath, [scriptPath, 'up'], {
    cwd: path.join(__dirname, '..', '..'),
    env: process.env,
    encoding: 'utf8',
  });

  const status = typeof result.status === 'number' ? result.status : 1;
  if (status !== 0) {
    const stderr = String(result.stderr || '').trim();
    const stdout = String(result.stdout || '').trim();
    const detail = stderr || stdout || 'falha desconhecida no node-pg-migrate';
    const err = new Error(`Auto-migrate pgm falhou (exit=${status}): ${detail}`);
    err.exitCode = status;
    throw err;
  }

  return {
    fase: 'pgm',
    total: 1,
    ok: 1,
    erros: 0,
    elapsedMs: Date.now() - startedAt,
  };
}

async function runStartupMigrations() {
  const enabled = envBool('AUTO_MIGRATE_ON_START', true);
  const logOnly = envBool('AUTO_MIGRATE_LOG_ONLY', true);
  const mode = parseMode(process.env.AUTO_MIGRATE_MODE || 'baseline+pgm');

  const report = {
    enabled,
    mode: [...mode].join('+') || 'none',
    total: 0,
    ok: 0,
    erros: 0,
    passos: [],
  };

  if (!enabled) {
    logger.info('MIGRATE', 'Auto-migrate desativado por AUTO_MIGRATE_ON_START.');
    return report;
  }

  const steps = [];
  if (mode.has('baseline')) steps.push({ nome: 'baseline', fn: runBaselineReconciliations });
  if (mode.has('pgm')) steps.push({ nome: 'pgm', fn: runPgmMigrations });

  for (const step of steps) {
    report.total += 1;
    try {
      const out = await step.fn();
      report.ok += 1;
      report.passos.push({ nome: step.nome, ok: true, detalhe: out });
      logger.info('MIGRATE', `Startup migrate (${step.nome}) concluído com sucesso.`);
    } catch (err) {
      report.erros += 1;
      report.passos.push({ nome: step.nome, ok: false, erro: err.message });
      logger.error('MIGRATE', `Startup migrate (${step.nome}) falhou`, err);
      if (!logOnly) throw err;
      logger.warn('MIGRATE', 'AUTO_MIGRATE_LOG_ONLY ativo: servidor continuará mesmo com erro de migração.');
    }
  }

  return report;
}

module.exports = {
  runStartupMigrations,
};
