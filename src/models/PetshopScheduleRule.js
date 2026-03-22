const { query } = require('../config/database');

const PetshopScheduleRule = {
  async upsertSemanal(petshopId, regra) {
    const result = await query(
      `INSERT INTO petshop_schedule_rules (
        petshop_id, dia_semana, abre, fecha, intervalo_inicio, intervalo_fim, ativo
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (petshop_id, dia_semana) DO UPDATE SET
        abre = EXCLUDED.abre,
        fecha = EXCLUDED.fecha,
        intervalo_inicio = EXCLUDED.intervalo_inicio,
        intervalo_fim = EXCLUDED.intervalo_fim,
        ativo = true
      RETURNING *`,
      [
        petshopId,
        regra.dia_semana,
        regra.abre,
        regra.fecha,
        regra.intervalo_inicio || null,
        regra.intervalo_fim || null,
      ]
    );
    return result.rows[0];
  },
};

module.exports = PetshopScheduleRule;
