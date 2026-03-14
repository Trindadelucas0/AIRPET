const { query } = require('../config/database');

const Comentario = {

  async criar(dados) {
    const { usuario_id, publicacao_id, texto } = dados;
    const resultado = await query(
      `INSERT INTO comentarios (usuario_id, publicacao_id, texto)
       VALUES ($1, $2, $3) RETURNING *`,
      [usuario_id, publicacao_id, texto]
    );
    return resultado.rows[0];
  },

  async buscarPorPublicacao(publicacaoId, limite = 50) {
    const resultado = await query(
      `SELECT c.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil
       FROM comentarios c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.publicacao_id = $1
       ORDER BY c.criado_em ASC
       LIMIT $2`,
      [publicacaoId, limite]
    );
    return resultado.rows;
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM comentarios WHERE id = $1 RETURNING *`,
      [id]
    );
    return resultado.rows[0];
  },

  async contar(publicacaoId) {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM comentarios WHERE publicacao_id = $1`,
      [publicacaoId]
    );
    return parseInt(resultado.rows[0].total);
  },
};

module.exports = Comentario;
