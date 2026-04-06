const { query } = require('../config/database');

const MAX_FOTOS_FEED = 10;

const PetshopPost = {
  async criar(dados) {
    const result = await query(
      `INSERT INTO petshop_posts (
        petshop_id, criado_por_account_id, post_type, approval_status, titulo, texto, foto_url,
        is_highlighted, highlight_rank
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dados.petshop_id,
        dados.criado_por_account_id || null,
        dados.post_type || 'normal',
        dados.approval_status || 'aprovado',
        dados.titulo || null,
        dados.texto || null,
        dados.foto_url || null,
        !!dados.is_highlighted,
        dados.highlight_rank != null ? Number(dados.highlight_rank) : 0,
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

  async contarFotosFeedAtivas(petshopId) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_posts
       WHERE petshop_id = $1
         AND ativo = true
         AND approval_status = 'aprovado'
         AND post_type = 'normal'
         AND NULLIF(BTRIM(COALESCE(foto_url, '')), '') IS NOT NULL`,
      [petshopId]
    );
    return result.rows[0]?.total || 0;
  },

  async buscarFotoFeedMaisAntiga(petshopId) {
    const result = await query(
      `SELECT *
       FROM petshop_posts
       WHERE petshop_id = $1
         AND ativo = true
         AND approval_status = 'aprovado'
         AND post_type = 'normal'
         AND NULLIF(BTRIM(COALESCE(foto_url, '')), '') IS NOT NULL
       ORDER BY COALESCE(publicado_em, data_criacao) ASC, id ASC
       LIMIT 1`,
      [petshopId]
    );
    return result.rows[0] || null;
  },

  async desativar(id) {
    const result = await query(
      `UPDATE petshop_posts
       SET ativo = false, data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
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

PetshopPost.MAX_FOTOS_FEED = MAX_FOTOS_FEED;

module.exports = PetshopPost;
