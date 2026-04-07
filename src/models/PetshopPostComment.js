const { query } = require('../config/database');

const PetshopPostComment = {
  async criar({ usuario_id, publicationType, publicationId, texto }) {
    if (!usuario_id) return null;
    if (!publicationType || !publicationId) return null;
    const result = await query(
      `INSERT INTO petshop_publication_comments (usuario_id, publication_type, publication_id, texto)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [usuario_id, publicationType, publicationId, texto]
    );
    return result.rows[0] || null;
  },

  async deletar({ commentId, usuarioId }) {
    const result = await query(
      `DELETE FROM petshop_publication_comments
       WHERE id = $1 AND usuario_id = $2
       RETURNING *`,
      [commentId, usuarioId]
    );
    return result.rows[0] || null;
  },

  async listarPorPublicacao(publicationType, publicationId, limit = 200) {
    const lim = Number.isInteger(limit) && limit > 0 ? limit : 200;
    const result = await query(
      `SELECT
          c.id,
          c.usuario_id,
          c.publication_type,
          c.publication_id,
          c.texto,
          c.created_em AS criado_em,
          u.nome,
          u.foto_perfil,
          u.cor_perfil
       FROM petshop_publication_comments c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.publication_type = $1 AND c.publication_id = $2
       ORDER BY c.created_em DESC
       LIMIT $3`,
      [publicationType, publicationId, lim]
    );
    return result.rows;
  },

  async contarPorPublicacao(publicationType, publicationId) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_publication_comments
       WHERE publication_type = $1 AND publication_id = $2`,
      [publicationType, publicationId]
    );
    return result.rows[0] ? result.rows[0].total : 0;
  },

  async contarPorPetshopDesde(petshopId, inicioPeriodo) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_publication_comments c
       WHERE c.created_em >= $2
         AND (
           (c.publication_type = 'petshop_post' AND EXISTS (
             SELECT 1 FROM petshop_posts pp WHERE pp.id = c.publication_id AND pp.petshop_id = $1
           ))
           OR
           (c.publication_type = 'petshop_product' AND EXISTS (
             SELECT 1 FROM petshop_products pr WHERE pr.id = c.publication_id AND pr.petshop_id = $1
           ))
         )`,
      [petshopId, inicioPeriodo]
    );
    return result.rows[0]?.total || 0;
  },
};

module.exports = PetshopPostComment;

