const { query } = require('../config/database');

const RefreshToken = {
  async inserir({ usuarioId, tokenHash, expiraEm, userAgent }) {
    const r = await query(
      `INSERT INTO refresh_tokens (usuario_id, token_hash, expira_em, user_agent)
       VALUES ($1, $2, $3, $4)
       RETURNING id, criado_em`,
      [usuarioId, tokenHash, expiraEm, userAgent || null]
    );
    return r.rows[0];
  },

  async buscarValidoPorHash(tokenHash) {
    const r = await query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1
         AND revogado_em IS NULL
         AND expira_em > NOW()`,
      [tokenHash]
    );
    return r.rows[0] || null;
  },

  async revogarPorHash(tokenHash) {
    await query(
      `UPDATE refresh_tokens SET revogado_em = NOW() WHERE token_hash = $1 AND revogado_em IS NULL`,
      [tokenHash]
    );
  },

  async revogarTodosDoUsuario(usuarioId) {
    await query(
      `UPDATE refresh_tokens SET revogado_em = NOW()
       WHERE usuario_id = $1 AND revogado_em IS NULL`,
      [usuarioId]
    );
  },
};

module.exports = RefreshToken;
