const { query } = require('../config/database');

const PostIdempotencyKey = {
  async limparExpiradas() {
    await query(`DELETE FROM post_idempotency_keys WHERE expires_at < NOW()`);
  },

  async buscarValida(userId, idempotencyKey) {
    const row = await query(
      `SELECT response_body, status_code, request_hash
       FROM post_idempotency_keys
      WHERE user_id = $1
        AND idempotency_key = $2
        AND expires_at > NOW()
      LIMIT 1`,
      [userId, idempotencyKey]
    );
    return row.rows[0] || null;
  },

  async salvarOuAtualizar(userId, idempotencyKey, requestHash, statusCode, payload) {
    await query(
      `INSERT INTO post_idempotency_keys (user_id, idempotency_key, request_hash, response_body, status_code, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW() + interval '60 seconds')
       ON CONFLICT (user_id, idempotency_key) DO UPDATE
       SET request_hash = EXCLUDED.request_hash,
           response_body = EXCLUDED.response_body,
           status_code = EXCLUDED.status_code,
           expires_at = EXCLUDED.expires_at`,
      [userId, idempotencyKey, requestHash || null, JSON.stringify(payload || {}), statusCode || 200]
    );
  },
};

module.exports = PostIdempotencyKey;
