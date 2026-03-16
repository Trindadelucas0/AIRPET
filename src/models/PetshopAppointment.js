const { query } = require('../config/database');

const PetshopAppointment = {
  async criar({ petshop_id, service_id, usuario_id, pet_id, observacoes, data_agendada }) {
    const result = await query(
      `INSERT INTO petshop_appointments (
        petshop_id, service_id, usuario_id, pet_id, observacoes, data_agendada, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pendente')
      RETURNING *`,
      [petshop_id, service_id || null, usuario_id, pet_id, observacoes || null, data_agendada]
    );
    return result.rows[0];
  },

  async listarPorPetshop(petshopId) {
    const result = await query(
      `SELECT a.*, u.nome AS usuario_nome, p.nome AS pet_nome, s.nome AS servico_nome
       FROM petshop_appointments a
       JOIN usuarios u ON u.id = a.usuario_id
       JOIN pets p ON p.id = a.pet_id
       LEFT JOIN petshop_services s ON s.id = a.service_id
       WHERE a.petshop_id = $1
       ORDER BY a.data_agendada ASC`,
      [petshopId]
    );
    return result.rows;
  },

  async atualizarStatus(id, status, motivo_recusa = null) {
    const result = await query(
      `UPDATE petshop_appointments
       SET status = $2,
           motivo_recusa = CASE WHEN $2 = 'recusado' THEN $3 ELSE NULL END,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, motivo_recusa]
    );
    return result.rows[0];
  },
};

module.exports = PetshopAppointment;
