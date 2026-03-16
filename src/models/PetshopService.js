const { query } = require('../config/database');

const PetshopService = {
  async criar({ petshop_id, nome, descricao, duracao_minutos, preco_base }) {
    const result = await query(
      `INSERT INTO petshop_services (petshop_id, nome, descricao, duracao_minutos, preco_base, ativo)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (petshop_id, nome) DO UPDATE SET
         descricao = EXCLUDED.descricao,
         duracao_minutos = EXCLUDED.duracao_minutos,
         preco_base = EXCLUDED.preco_base,
         ativo = true
       RETURNING *`,
      [petshop_id, nome, descricao || null, duracao_minutos || 30, preco_base || null]
    );
    return result.rows[0];
  },

  async listarAtivos(petshopId) {
    const result = await query(
      `SELECT * FROM petshop_services
       WHERE petshop_id = $1 AND ativo = true
       ORDER BY nome ASC`,
      [petshopId]
    );
    return result.rows;
  },
};

module.exports = PetshopService;
