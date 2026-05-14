const { query } = require('../config/database');

const Grupo = {
  async listarPublicos(limite = 30) {
    const r = await query(
      `SELECT g.*, u.nome AS criador_nome
       FROM grupos g
       LEFT JOIN usuarios u ON u.id = g.criado_por
       WHERE g.privacidade = 'aberto'
       ORDER BY g.membros_count DESC, g.data_criacao DESC
       LIMIT $1`,
      [limite]
    );
    return r.rows;
  },

  async buscarPorSlug(slug) {
    const r = await query(`SELECT * FROM grupos WHERE slug = $1 LIMIT 1`, [String(slug).toLowerCase()]);
    return r.rows[0] || null;
  },

  async idsGruposDoUsuario(userId) {
    const r = await query(
      `SELECT grupo_id FROM grupo_membros WHERE user_id = $1`,
      [userId]
    );
    return r.rows.map((row) => row.grupo_id);
  },

  async entrar(grupoId, userId) {
    await query(
      `INSERT INTO grupo_membros (grupo_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [grupoId, userId]
    );
    await query(
      `UPDATE grupos SET membros_count = (SELECT COUNT(*) FROM grupo_membros WHERE grupo_id = $1) WHERE id = $1`,
      [grupoId]
    );
  },
};

module.exports = Grupo;
