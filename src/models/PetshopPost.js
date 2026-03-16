const { query } = require('../config/database');

const PetshopPost = {
  async criar(dados) {
    const result = await query(
      `INSERT INTO petshop_posts (
        petshop_id, criado_por_account_id, post_type, approval_status, titulo, texto, foto_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        dados.petshop_id,
        dados.criado_por_account_id || null,
        dados.post_type || 'normal',
        dados.approval_status || 'aprovado',
        dados.titulo || null,
        dados.texto || null,
        dados.foto_url || null,
      ]
    );
    return result.rows[0];
  },

  async listarPublicosPorPetshop(petshopId) {
    const result = await query(
      `SELECT *
       FROM petshop_posts
       WHERE petshop_id = $1
         AND ativo = true
         AND approval_status = 'aprovado'
         AND post_type = 'normal'
       ORDER BY publicado_em DESC`,
      [petshopId]
    );
    return result.rows;
  },

  async listarModeracaoPendentes() {
    const result = await query(
      `SELECT pp.*, p.nome AS petshop_nome
       FROM petshop_posts pp
       JOIN petshops p ON p.id = pp.petshop_id
       WHERE pp.post_type = 'promocao'
         AND pp.approval_status = 'pendente'
       ORDER BY pp.data_criacao ASC`
    );
    return result.rows;
  },

  async atualizarAprovacao(id, approvalStatus) {
    const result = await query(
      `UPDATE petshop_posts
       SET approval_status = $2, data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, approvalStatus]
    );
    return result.rows[0];
  },
};

module.exports = PetshopPost;
