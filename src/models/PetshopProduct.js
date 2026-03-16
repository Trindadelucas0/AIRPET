const { query } = require('../config/database');

const PetshopProduct = {
  async criar(dados) {
    const result = await query(
      `INSERT INTO petshop_products (
        petshop_id, post_id, nome, preco, descricao, foto_url, contato_link, is_promocao, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *`,
      [
        dados.petshop_id,
        dados.post_id || null,
        dados.nome,
        dados.preco || 0,
        dados.descricao || null,
        dados.foto_url || null,
        dados.contato_link || null,
        !!dados.is_promocao,
      ]
    );
    return result.rows[0];
  },

  async listarAtivosPorPetshop(petshopId) {
    const result = await query(
      `SELECT *
       FROM petshop_products
       WHERE petshop_id = $1 AND is_active = true
       ORDER BY data_criacao DESC`,
      [petshopId]
    );
    return result.rows;
  },

  async contarAtivosPorPetshop(petshopId) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_products
       WHERE petshop_id = $1 AND is_active = true`,
      [petshopId]
    );
    return result.rows[0].total;
  },
};

module.exports = PetshopProduct;
