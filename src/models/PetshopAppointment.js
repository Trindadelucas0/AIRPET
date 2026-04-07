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

  async criarComPrazo({
    petshop_id,
    service_id,
    usuario_id,
    pet_id,
    observacoes,
    data_agendada,
    status = 'pendente',
    expires_at = null,
  }) {
    const result = await query(
      `INSERT INTO petshop_appointments (
        petshop_id, service_id, usuario_id, pet_id, observacoes, data_agendada, status, data_criacao, data_atualizacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [petshop_id, service_id || null, usuario_id, pet_id, observacoes || null, data_agendada, status || 'pendente']
    );
    const row = result.rows[0];
    if (row && expires_at) {
      // Coluna expires_at pode não existir em ambientes legados; ignora falha.
      try {
        await query(
          `UPDATE petshop_appointments SET expires_at = $2, data_atualizacao = NOW() WHERE id = $1`,
          [row.id, expires_at]
        );
      } catch (_) {}
    }
    return row;
  },

  async listarPorPetshop(petshopId) {
    const result = await query(
      `SELECT a.*, u.nome AS usuario_nome, u.email AS usuario_email, u.telefone AS usuario_telefone,
              p.nome AS pet_nome, p.foto AS pet_foto, p.tipo AS pet_tipo, p.raca AS pet_raca, p.porte AS pet_porte,
              s.nome AS servico_nome, s.duracao_minutos, s.preco_base
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

  async listarPorPetshopNoDia(petshopId, inicioDia, fimDia) {
    const result = await query(
      `SELECT a.*, u.nome AS usuario_nome, u.email AS usuario_email, u.telefone AS usuario_telefone,
              p.nome AS pet_nome, p.foto AS pet_foto, p.tipo AS pet_tipo, p.raca AS pet_raca, p.porte AS pet_porte,
              s.nome AS servico_nome, s.duracao_minutos, s.preco_base
       FROM petshop_appointments a
       JOIN usuarios u ON u.id = a.usuario_id
       JOIN pets p ON p.id = a.pet_id
       LEFT JOIN petshop_services s ON s.id = a.service_id
       WHERE a.petshop_id = $1
         AND a.data_agendada >= $2
         AND a.data_agendada < $3
       ORDER BY a.data_agendada ASC`,
      [petshopId, inicioDia, fimDia]
    );
    return result.rows;
  },

  async listarPorUsuario(usuarioId) {
    const result = await query(
      `SELECT a.*,
              pshop.nome AS petshop_nome,
              pshop.endereco AS petshop_endereco,
              pshop.telefone AS petshop_telefone,
              pshop.latitude AS petshop_latitude,
              pshop.longitude AS petshop_longitude,
              p.nome AS pet_nome,
              p.foto AS pet_foto,
              p.tipo AS pet_tipo,
              p.raca AS pet_raca,
              p.porte AS pet_porte,
              s.nome AS servico_nome,
              s.duracao_minutos,
              s.preco_base
       FROM petshop_appointments a
       JOIN petshops pshop ON pshop.id = a.petshop_id
       JOIN pets p ON p.id = a.pet_id
       LEFT JOIN petshop_services s ON s.id = a.service_id
       WHERE a.usuario_id = $1
       ORDER BY a.data_agendada ASC`,
      [usuarioId]
    );
    return result.rows;
  },

  async listarPorUsuarioNoIntervalo(usuarioId, inicio, fim) {
    const result = await query(
      `SELECT a.*
       FROM petshop_appointments a
       WHERE a.usuario_id = $1
         AND a.data_agendada >= $2
         AND a.data_agendada < $3
       ORDER BY a.data_agendada ASC`,
      [usuarioId, inicio, fim]
    );
    return result.rows;
  },

  async contarPorDiaNoIntervalo(
    petshopId,
    inicio,
    fim,
    statuses = ['pendente', 'aceito', 'concluido']
  ) {
    const result = await query(
      `SELECT TO_CHAR(DATE(a.data_agendada), 'YYYY-MM-DD') AS dia,
              COUNT(*)::int AS total
       FROM petshop_appointments a
       WHERE a.petshop_id = $1
         AND a.data_agendada >= $2
         AND a.data_agendada < $3
         AND a.status = ANY($4::text[])
       GROUP BY DATE(a.data_agendada)`,
      [petshopId, inicio, fim, statuses]
    );
    return result.rows;
  },

  async buscarPorId(id) {
    const result = await query(
      `SELECT a.*,
              pshop.nome AS petshop_nome,
              pshop.endereco AS petshop_endereco,
              pshop.telefone AS petshop_telefone,
              pshop.latitude AS petshop_latitude,
              pshop.longitude AS petshop_longitude,
              u.nome AS usuario_nome,
              u.email AS usuario_email,
              u.telefone AS usuario_telefone,
              p.nome AS pet_nome,
              p.foto AS pet_foto,
              p.tipo AS pet_tipo,
              p.raca AS pet_raca,
              p.porte AS pet_porte,
              s.nome AS servico_nome,
              s.duracao_minutos,
              s.preco_base
       FROM petshop_appointments a
       JOIN petshops pshop ON pshop.id = a.petshop_id
       JOIN usuarios u ON u.id = a.usuario_id
       JOIN pets p ON p.id = a.pet_id
       LEFT JOIN petshop_services s ON s.id = a.service_id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async buscarPorIdDoUsuario(id, usuarioId) {
    const result = await query(
      `SELECT *
       FROM petshop_appointments
       WHERE id = $1
         AND usuario_id = $2`,
      [id, usuarioId]
    );
    return result.rows[0] || null;
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

  async cancelarPorUsuario(id, usuarioId) {
    const result = await query(
      `UPDATE petshop_appointments
       SET status = 'cancelado',
           data_atualizacao = NOW()
       WHERE id = $1
         AND usuario_id = $2
         AND status IN ('pendente', 'aceito')
       RETURNING *`,
      [id, usuarioId]
    );
    return result.rows[0] || null;
  },

  async listarPendentesComExpiracao(maxRows = 300) {
    const result = await query(
      `SELECT *
       FROM petshop_appointments
       WHERE status = 'pendente'
       ORDER BY data_criacao ASC
       LIMIT $1`,
      [maxRows]
    );
    return result.rows;
  },

  async marcarExpirado(id) {
    const result = await query(
      `UPDATE petshop_appointments
       SET status = 'expirado',
           data_atualizacao = NOW()
       WHERE id = $1
         AND status = 'pendente'
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },
};

module.exports = PetshopAppointment;
