const { query } = require('../config/database');

const PetDoMes = {
  async buscarOuCriarEdicaoMesAtual() {
    const mr = await query(`SELECT date_trunc('month', CURRENT_DATE)::date AS mes_ref`);
    const mesRef = mr.rows[0].mes_ref;
    await query(
      `INSERT INTO pet_do_mes_edicoes (mes_ref, estado, encerra_em)
       VALUES ($1, 'aberta', ($1::timestamp + INTERVAL '1 month' - INTERVAL '1 second') AT TIME ZONE 'UTC')
       ON CONFLICT (mes_ref) DO NOTHING`,
      [mesRef]
    );
    const r = await query(`SELECT * FROM pet_do_mes_edicoes WHERE mes_ref = $1 LIMIT 1`, [mesRef]);
    return r.rows[0] || null;
  },

  async listarRanking(edicaoId, limite = 10) {
    const r = await query(
      `SELECT pet_id, COUNT(*)::int AS votos
       FROM pet_do_mes_votos
       WHERE edicao_id = $1
       GROUP BY pet_id
       ORDER BY votos DESC, pet_id ASC
       LIMIT $2`,
      [edicaoId, limite]
    );
    return r.rows;
  },

  async votar(edicaoId, petId, userId) {
    await query(
      `INSERT INTO pet_do_mes_votos (edicao_id, pet_id, user_id) VALUES ($1, $2, $3)
       ON CONFLICT (edicao_id, user_id) DO UPDATE SET pet_id = EXCLUDED.pet_id, criado_em = NOW()`,
      [edicaoId, petId, userId]
    );
  },

  async usuarioVoto(edicaoId, userId) {
    const r = await query(
      `SELECT pet_id FROM pet_do_mes_votos WHERE edicao_id = $1 AND user_id = $2`,
      [edicaoId, userId]
    );
    return r.rows[0] || null;
  },
};

module.exports = PetDoMes;
