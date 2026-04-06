/**
 * Persistência de métricas no PostgreSQL (mesma BD da app).
 */

const { query } = require('../../../config/database');

const COUNTER_ACCESS = 'http_access_total';

async function adjustStorage(deltaBytes, deltaCount) {
  const b = Number(deltaBytes) || 0;
  const c = Number(deltaCount) || 0;
  await query(
    `UPDATE app_metrics_storage_aggregate
     SET total_bytes = GREATEST(0, total_bytes + $1::bigint),
         total_objects = GREATEST(0, total_objects + $2::bigint),
         updated_at = NOW()
     WHERE id = 1`,
    [b, c]
  );
}

async function setStorageTotals(totalBytes, totalObjects) {
  await query(
    `UPDATE app_metrics_storage_aggregate
     SET total_bytes = GREATEST(0, $1::bigint),
         total_objects = GREATEST(0, $2::bigint),
         updated_at = NOW()
     WHERE id = 1`,
    [Number(totalBytes) || 0, Number(totalObjects) || 0]
  );
}

async function incrementAccessTotal() {
  const r = await query(
    `UPDATE app_metrics_counter
     SET value = value + 1, updated_at = NOW()
     WHERE name = $1
     RETURNING value`,
    [COUNTER_ACCESS]
  );
  return r.rows[0] ? Number(r.rows[0].value) : 0;
}

async function getStorageAggregate() {
  const r = await query(
    `SELECT total_bytes, total_objects, updated_at
     FROM app_metrics_storage_aggregate WHERE id = 1`
  );
  if (!r.rows[0]) {
    return { totalBytes: 0, totalObjects: 0, updatedAt: null };
  }
  const row = r.rows[0];
  return {
    totalBytes: Number(row.total_bytes) || 0,
    totalObjects: Number(row.total_objects) || 0,
    updatedAt: row.updated_at,
  };
}

async function getAccessTotal() {
  const r = await query(`SELECT value FROM app_metrics_counter WHERE name = $1`, [COUNTER_ACCESS]);
  return r.rows[0] ? Number(r.rows[0].value) : 0;
}

async function getMeta(key) {
  const r = await query(
    `SELECT value_text, value_timestamptz FROM app_metrics_meta WHERE key = $1`,
    [key]
  );
  if (!r.rows[0]) return { text: null, time: null };
  return { text: r.rows[0].value_text, time: r.rows[0].value_timestamptz };
}

async function setMeta(key, { text = null, time = null } = {}) {
  await query(
    `INSERT INTO app_metrics_meta (key, value_text, value_timestamptz)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET
       value_text = CASE WHEN EXCLUDED.value_text IS NOT NULL THEN EXCLUDED.value_text ELSE app_metrics_meta.value_text END,
       value_timestamptz = CASE WHEN EXCLUDED.value_timestamptz IS NOT NULL THEN EXCLUDED.value_timestamptz ELSE app_metrics_meta.value_timestamptz END`,
    [key, text, time]
  );
}

module.exports = {
  adjustStorage,
  setStorageTotals,
  incrementAccessTotal,
  getStorageAggregate,
  getAccessTotal,
  getMeta,
  setMeta,
};
