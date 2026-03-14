const { query } = require('../config/database');

const Seguidor = {

  async seguir(seguidorId, seguidoId) {
    if (seguidorId === seguidoId) return null;
    const resultado = await query(
      `INSERT INTO seguidores (seguidor_id, seguido_id)
       VALUES ($1, $2)
       ON CONFLICT (seguidor_id, seguido_id) DO NOTHING
       RETURNING *`,
      [seguidorId, seguidoId]
    );
    return resultado.rows[0];
  },

  async deixarDeSeguir(seguidorId, seguidoId) {
    const resultado = await query(
      `DELETE FROM seguidores WHERE seguidor_id = $1 AND seguido_id = $2 RETURNING *`,
      [seguidorId, seguidoId]
    );
    return resultado.rows[0];
  },

  async estaSeguindo(seguidorId, seguidoId) {
    const resultado = await query(
      `SELECT 1 FROM seguidores WHERE seguidor_id = $1 AND seguido_id = $2`,
      [seguidorId, seguidoId]
    );
    return resultado.rows.length > 0;
  },

  async contarSeguidores(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM seguidores WHERE seguido_id = $1`,
      [usuarioId]
    );
    return parseInt(resultado.rows[0].total);
  },

  async contarSeguindo(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM seguidores WHERE seguidor_id = $1`,
      [usuarioId]
    );
    return parseInt(resultado.rows[0].total);
  },

  async listarSeguidores(usuarioId, limite = 50) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, s.criado_em
       FROM seguidores s
       JOIN usuarios u ON u.id = s.seguidor_id
       WHERE s.seguido_id = $1
       ORDER BY s.criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return resultado.rows;
  },

  async listarSeguindo(usuarioId, limite = 50) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, s.criado_em
       FROM seguidores s
       JOIN usuarios u ON u.id = s.seguido_id
       WHERE s.seguidor_id = $1
       ORDER BY s.criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return resultado.rows;
  },
};

module.exports = Seguidor;
