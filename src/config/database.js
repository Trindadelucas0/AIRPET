/**
 * database.js — Configuracao de conexao com PostgreSQL
 *
 * Cria um pool de conexoes reutilizavel usando o modulo 'pg'.
 * Todas as credenciais veem do .env (nunca hardcoded).
 * O pool gerencia automaticamente conexoes abertas/fechadas.
 */

const { performance } = require('node:perf_hooks');
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('DB', 'Erro inesperado no pool de conexoes', err);
});

const SLOW_QUERY_MS = parseInt(process.env.DB_SLOW_QUERY_MS || '1000', 10);
const SLOW_SQL_PREVIEW_LEN = parseInt(process.env.DB_SLOW_SQL_PREVIEW_LEN || '200', 10);

function truncateSqlPreview(text) {
  if (!text || typeof text !== 'string') return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= SLOW_SQL_PREVIEW_LEN ? t : `${t.slice(0, SLOW_SQL_PREVIEW_LEN)}…`;
}

/**
 * Executa uma query parametrizada no banco.
 * Sempre use $1, $2... para evitar SQL injection.
 * Registra aviso se a duracao ultrapassar DB_SLOW_QUERY_MS (default 1000).
 *
 * @param {string} text - Query SQL com placeholders ($1, $2...)
 * @param {Array} params - Valores dos placeholders
 * @returns {Promise<object>} Resultado da query
 */
async function query(text, params) {
  const t0 = performance.now();
  try {
    const result = await pool.query(text, params);
    const ms = performance.now() - t0;
    if (ms >= SLOW_QUERY_MS) {
      logger.warn(
        'DB',
        `Query lenta ${ms.toFixed(0)}ms (limiar ${SLOW_QUERY_MS}ms) — ${truncateSqlPreview(text)}`
      );
    }
    return result;
  } catch (err) {
    const ms = performance.now() - t0;
    logger.error(
      'DB',
      `Query falhou apos ${ms.toFixed(0)}ms — ${truncateSqlPreview(text)}`,
      err
    );
    throw err;
  }
}

/**
 * Obtem uma conexao individual do pool.
 * Util para transacoes (BEGIN / COMMIT / ROLLBACK).
 * IMPORTANTE: sempre chame client.release() ao terminar.
 */
const getClient = () => pool.connect();

/**
 * Metricas atuais do pool (uso em /health/db ou diagnostico).
 */
function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

/**
 * Executa callback dentro de uma transacao (BEGIN / COMMIT / ROLLBACK).
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, getClient, getPoolStats, withTransaction };
