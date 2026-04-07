const { query } = require('../config/database');

const PetshopFollower = {
  async seguir(petshopId, usuarioId) {
    const result = await query(
      `INSERT INTO petshop_followers (petshop_id, usuario_id)
       VALUES ($1, $2)
       ON CONFLICT (petshop_id, usuario_id) DO NOTHING
       RETURNING *`,
      [petshopId, usuarioId]
    );
    return result.rows[0] || null;
  },

  async deixarDeSeguir(petshopId, usuarioId) {
    await query(`DELETE FROM petshop_followers WHERE petshop_id = $1 AND usuario_id = $2`, [petshopId, usuarioId]);
  },

  async contarSeguidores(petshopId) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_followers
       WHERE petshop_id = $1`,
      [petshopId]
    );
    return result.rows[0].total;
  },

  async listarSeguidores(petshopId) {
    const result = await query(
      `SELECT usuario_id
       FROM petshop_followers
       WHERE petshop_id = $1`,
      [petshopId]
    );
    return result.rows;
  },

  async contarNovosSeguidoresDesde(petshopId, inicioPeriodo) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_followers
       WHERE petshop_id = $1
         AND data_criacao >= $2`,
      [petshopId, inicioPeriodo]
    );
    return result.rows[0]?.total || 0;
  },

  async usuarioSegue(petshopId, usuarioId) {
    const result = await query(
      `SELECT 1
       FROM petshop_followers
       WHERE petshop_id = $1 AND usuario_id = $2`,
      [petshopId, usuarioId]
    );
    return result.rows.length > 0;
  },
};

module.exports = PetshopFollower;
