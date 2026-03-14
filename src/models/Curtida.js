const { query } = require('../config/database');

const Curtida = {

  async curtir(usuarioId, publicacaoId) {
    const resultado = await query(
      `INSERT INTO curtidas (usuario_id, publicacao_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, publicacao_id) DO NOTHING
       RETURNING *`,
      [usuarioId, publicacaoId]
    );
    return resultado.rows[0];
  },

  async descurtir(usuarioId, publicacaoId) {
    const resultado = await query(
      `DELETE FROM curtidas WHERE usuario_id = $1 AND publicacao_id = $2 RETURNING *`,
      [usuarioId, publicacaoId]
    );
    return resultado.rows[0];
  },

  async verificar(usuarioId, publicacaoId) {
    const resultado = await query(
      `SELECT 1 FROM curtidas WHERE usuario_id = $1 AND publicacao_id = $2`,
      [usuarioId, publicacaoId]
    );
    return resultado.rows.length > 0;
  },

  async contar(publicacaoId) {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM curtidas WHERE publicacao_id = $1`,
      [publicacaoId]
    );
    return parseInt(resultado.rows[0].total);
  },
};

module.exports = Curtida;
