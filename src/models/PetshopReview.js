const { query } = require('../config/database');

const PetshopReview = {
  async criarOuAtualizar({ petshop_id, usuario_id, pet_id, rating, comentario }) {
    const result = await query(
      `INSERT INTO petshop_reviews (petshop_id, usuario_id, pet_id, rating, comentario)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (petshop_id, usuario_id, pet_id) DO UPDATE SET
         rating = EXCLUDED.rating,
         comentario = EXCLUDED.comentario,
         data_atualizacao = NOW()
       RETURNING *`,
      [petshop_id, usuario_id, pet_id || null, rating, comentario || null]
    );
    return result.rows[0];
  },

  async listarPorPetshop(petshopId) {
    const result = await query(
      `SELECT pr.*, u.nome AS usuario_nome, u.foto_perfil AS usuario_foto
       FROM petshop_reviews pr
       JOIN usuarios u ON u.id = pr.usuario_id
       WHERE pr.petshop_id = $1 AND pr.status = 'publicado'
       ORDER BY pr.data_criacao DESC
       LIMIT 100`,
      [petshopId]
    );
    return result.rows;
  },

  async resumoPorPetshop(petshopId) {
    const result = await query(
      `SELECT
         COALESCE(AVG(rating), 0)::numeric(3,2) AS media,
         COUNT(*)::int AS total
       FROM petshop_reviews
       WHERE petshop_id = $1 AND status = 'publicado'`,
      [petshopId]
    );
    return result.rows[0];
  },
};

module.exports = PetshopReview;
