const { query } = require('../config/database');

const PetPetshopLink = {
  async vincular({ pet_id, petshop_id, tipo_vinculo = 'cliente' }) {
    const result = await query(
      `INSERT INTO pet_petshop_links (pet_id, petshop_id, tipo_vinculo, ativo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (pet_id, petshop_id) DO UPDATE SET
         tipo_vinculo = EXCLUDED.tipo_vinculo,
         ativo = true,
         data_atualizacao = NOW()
       RETURNING *`,
      [pet_id, petshop_id, tipo_vinculo]
    );
    return result.rows[0];
  },

  async listarPetsDoPetshop(petshopId) {
    const result = await query(
      `SELECT l.*, p.nome AS pet_nome, p.foto AS pet_foto, p.usuario_id
       FROM pet_petshop_links l
       JOIN pets p ON p.id = l.pet_id
       WHERE l.petshop_id = $1 AND l.ativo = true`,
      [petshopId]
    );
    return result.rows;
  },

  async listarPorPet(petId) {
    const result = await query(
      `SELECT l.*, p.id AS petshop_id, p.nome AS petshop_nome, p.slug AS petshop_slug, p.logo_url, p.ativo
       FROM pet_petshop_links l
       JOIN petshops p ON p.id = l.petshop_id
       WHERE l.pet_id = $1 AND l.ativo = true
       ORDER BY l.data_criacao DESC`,
      [petId]
    );
    return result.rows;
  },

  async desvincular(petId, petshopId) {
    const result = await query(
      `UPDATE pet_petshop_links
       SET ativo = false, data_atualizacao = NOW()
       WHERE pet_id = $1 AND petshop_id = $2
       RETURNING *`,
      [petId, petshopId]
    );
    return result.rows[0] || null;
  },
};

module.exports = PetPetshopLink;
