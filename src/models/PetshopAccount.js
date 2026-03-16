const { query } = require('../config/database');

const PetshopAccount = {
  async criar({ petshop_id, email, password_hash, status = 'pendente_aprovacao' }) {
    const result = await query(
      `INSERT INTO petshop_accounts (petshop_id, email, password_hash, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [petshop_id, email, password_hash, status]
    );
    return result.rows[0];
  },

  async buscarPorEmail(email) {
    const result = await query(`SELECT * FROM petshop_accounts WHERE email = $1`, [email]);
    return result.rows[0];
  },

  async buscarPorId(id) {
    const result = await query(
      `SELECT pa.*, p.nome AS petshop_nome
       FROM petshop_accounts pa
       JOIN petshops p ON p.id = pa.petshop_id
       WHERE pa.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async atualizarStatusPorPetshopId(petshopId, status) {
    const result = await query(
      `UPDATE petshop_accounts
       SET status = $2, data_atualizacao = NOW()
       WHERE petshop_id = $1
       RETURNING *`,
      [petshopId, status]
    );
    return result.rows[0];
  },

  async registrarLogin(id) {
    await query(`UPDATE petshop_accounts SET ultimo_login_em = NOW() WHERE id = $1`, [id]);
  },
};

module.exports = PetshopAccount;
