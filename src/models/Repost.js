const { query } = require('../config/database');

const Repost = {

  async repostar(usuarioId, publicacaoId) {
    const resultado = await query(
      `INSERT INTO reposts (usuario_id, publicacao_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, publicacao_id) DO NOTHING
       RETURNING *`,
      [usuarioId, publicacaoId]
    );
    return resultado.rows[0];
  },

  async remover(usuarioId, publicacaoId) {
    const resultado = await query(
      `DELETE FROM reposts WHERE usuario_id = $1 AND publicacao_id = $2 RETURNING *`,
      [usuarioId, publicacaoId]
    );
    return resultado.rows[0];
  },

  async verificar(usuarioId, publicacaoId) {
    const resultado = await query(
      `SELECT 1 FROM reposts WHERE usuario_id = $1 AND publicacao_id = $2`,
      [usuarioId, publicacaoId]
    );
    return resultado.rows.length > 0;
  },

  async contar(publicacaoId) {
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM reposts WHERE publicacao_id = $1`,
      [publicacaoId]
    );
    return resultado.rows[0].total;
  },
};

module.exports = Repost;
