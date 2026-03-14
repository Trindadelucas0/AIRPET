const { query } = require('../config/database');

const DiarioPet = {

  async criar(dados) {
    const { pet_id, usuario_id, tipo, descricao, valor_numerico, foto, data, hora } = dados;

    const resultado = await query(
      `INSERT INTO diario_pet (pet_id, usuario_id, tipo, descricao, valor_numerico, foto, data, hora)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), COALESCE($8, CURRENT_TIME))
       RETURNING *`,
      [pet_id, usuario_id, tipo, descricao || null, valor_numerico || null, foto || null, data || null, hora || null]
    );

    return resultado.rows[0];
  },

  async buscarPorPetEData(pet_id, data) {
    const resultado = await query(
      `SELECT * FROM diario_pet
       WHERE pet_id = $1 AND data = $2
       ORDER BY hora DESC`,
      [pet_id, data]
    );

    return resultado.rows;
  },

  async buscarPorPet(pet_id, limit = 30) {
    const resultado = await query(
      `SELECT * FROM diario_pet
       WHERE pet_id = $1
       ORDER BY data DESC, hora DESC
       LIMIT $2`,
      [pet_id, limit]
    );

    return resultado.rows;
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM diario_pet WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },
};

module.exports = DiarioPet;
