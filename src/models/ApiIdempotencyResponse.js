const { query } = require('../config/database');

const TTL_HOURS = 24;

const ApiIdempotencyResponse = {
  async buscarRecente(usuarioId, scope, idempotencyKey) {
    const r = await query(
      `SELECT status_code, body_json, criado_em
       FROM api_idempotency_responses
       WHERE usuario_id = $1 AND scope = $2 AND idempotency_key = $3
         AND criado_em > NOW() - ($4::integer * INTERVAL '1 hour')`,
      [usuarioId, scope, idempotencyKey, TTL_HOURS]
    );
    return r.rows[0] || null;
  },

  async salvar(usuarioId, scope, idempotencyKey, statusCode, bodyJson) {
    await query(
      `INSERT INTO api_idempotency_responses (usuario_id, scope, idempotency_key, status_code, body_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (usuario_id, scope, idempotency_key)
       DO UPDATE SET status_code = EXCLUDED.status_code, body_json = EXCLUDED.body_json, criado_em = NOW()`,
      [usuarioId, scope, idempotencyKey, statusCode, JSON.stringify(bodyJson)]
    );
  },
};

module.exports = ApiIdempotencyResponse;
