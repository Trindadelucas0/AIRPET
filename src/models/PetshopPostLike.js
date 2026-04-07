const { query } = require('../config/database');

/**
 * Like de publicações do petshop.
 *
 * Aqui, publication_type pode ser:
 * - 'petshop_post' (tabela petshop_posts)
 * - 'petshop_product' (tabela petshop_products)
 *
 * publication_id é o id numérico da tabela origem.
 */
const PetshopPostLike = {
  async curtir(usuarioId, publicationType, publicationId) {
    if (!usuarioId) return null;
    if (!publicationType || !publicationId) return null;
    const result = await query(
      `INSERT INTO petshop_publication_likes (usuario_id, publication_type, publication_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, publication_type, publication_id) DO NOTHING
       RETURNING *`,
      [usuarioId, publicationType, publicationId]
    );
    return result.rows[0] || null;
  },

  async descurtir(usuarioId, publicationType, publicationId) {
    if (!usuarioId) return null;
    const result = await query(
      `DELETE FROM petshop_publication_likes
       WHERE usuario_id = $1 AND publication_type = $2 AND publication_id = $3
       RETURNING *`,
      [usuarioId, publicationType, publicationId]
    );
    return result.rows[0] || null;
  },

  async verificar(usuarioId, publicationType, publicationId) {
    if (!usuarioId) return false;
    const result = await query(
      `SELECT 1
       FROM petshop_publication_likes
       WHERE usuario_id = $1 AND publication_type = $2 AND publication_id = $3
       LIMIT 1`,
      [usuarioId, publicationType, publicationId]
    );
    return result.rows.length > 0;
  },

  async contar(publicationType, publicationId) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_publication_likes
       WHERE publication_type = $1 AND publication_id = $2`,
      [publicationType, publicationId]
    );
    return result.rows[0] ? result.rows[0].total : 0;
  },

  async contarPorPetshopDesde(petshopId, inicioPeriodo) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_publication_likes l
       WHERE l.created_em >= $2
         AND (
           (l.publication_type = 'petshop_post' AND EXISTS (
             SELECT 1 FROM petshop_posts pp WHERE pp.id = l.publication_id AND pp.petshop_id = $1
           ))
           OR
           (l.publication_type = 'petshop_product' AND EXISTS (
             SELECT 1 FROM petshop_products pr WHERE pr.id = l.publication_id AND pr.petshop_id = $1
           ))
         )`,
      [petshopId, inicioPeriodo]
    );
    return result.rows[0]?.total || 0;
  },
};

module.exports = PetshopPostLike;

