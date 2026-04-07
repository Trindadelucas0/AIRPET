const { query } = require('../config/database');

const PetshopScheduleRule = {
  async listarPorPetshop(petshopId) {
    const result = await query(
      `SELECT *
       FROM petshop_schedule_rules
       WHERE petshop_id = $1
       ORDER BY dia_semana ASC`,
      [petshopId]
    );
    return result.rows;
  },

  async upsertSemanal(petshopId, regra) {
    const ativo = regra.ativo !== false;
    const result = await query(
      `INSERT INTO petshop_schedule_rules (
        petshop_id, dia_semana, abre, fecha, intervalo_inicio, intervalo_fim, ativo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (petshop_id, dia_semana) DO UPDATE SET
        abre = EXCLUDED.abre,
        fecha = EXCLUDED.fecha,
        intervalo_inicio = EXCLUDED.intervalo_inicio,
        intervalo_fim = EXCLUDED.intervalo_fim,
        ativo = EXCLUDED.ativo
      RETURNING *`,
      [
        petshopId,
        regra.dia_semana,
        regra.abre,
        regra.fecha,
        regra.intervalo_inicio || null,
        regra.intervalo_fim || null,
        ativo,
      ]
    );
    return result.rows[0];
  },

  async desativarDia(petshopId, diaSemana) {
    const result = await query(
      `UPDATE petshop_schedule_rules
       SET ativo = false
       WHERE petshop_id = $1 AND dia_semana = $2
       RETURNING *`,
      [petshopId, diaSemana]
    );
    return result.rows[0] || null;
  },
};

module.exports = PetshopScheduleRule;
