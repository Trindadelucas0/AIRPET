/**
 * database.js — Configuracao de conexao com PostgreSQL
 *
 * Cria um pool de conexoes reutilizavel usando o modulo 'pg'.
 * Todas as credenciais vem do .env (nunca hardcoded).
 * O pool gerencia automaticamente conexoes abertas/fechadas.
 */

const { Pool } = require('pg');

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
  console.error('[DB] Erro inesperado no pool de conexoes:', err.message);
});

/**
 * Executa uma query parametrizada no banco.
 * Sempre use $1, $2... para evitar SQL injection.
 *
 * @param {string} text - Query SQL com placeholders ($1, $2...)
 * @param {Array} params - Valores dos placeholders
 * @returns {Promise<object>} Resultado da query
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtem uma conexao individual do pool.
 * Util para transacoes (BEGIN / COMMIT / ROLLBACK).
 * IMPORTANTE: sempre chame client.release() ao terminar.
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
