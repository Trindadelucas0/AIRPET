/**
 * AgendaPetshop.js — Modelo de dados para a tabela "agenda_petshop"
 *
 * Este módulo gerencia os agendamentos de serviços nos petshops parceiros.
 * Um tutor pode agendar banho, tosa, consulta veterinária, etc.
 *
 * Tabela: agenda_petshop
 * Campos principais: id, petshop_id, usuario_id, pet_id, servico,
 *                    data_agendamento, horario, status, observacoes,
 *                    data_criacao
 */

const { query } = require('../config/database');

const AgendaPetshop = {

  async criar(dados) {
    const {
      petshop_id, usuario_id, pet_id, servico,
      data_agendamento, horario, observacoes
    } = dados;

    const resultado = await query(
      `INSERT INTO agenda_petshop
        (petshop_id, usuario_id, pet_id, servico, data_agendamento, horario, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [petshop_id, usuario_id, pet_id, servico, data_agendamento, horario, observacoes]
    );

    return resultado.rows[0];
  },

  async buscarPorId(id) {
    const resultado = await query(
      `SELECT a.*,
              p.nome AS pet_nome, p.tipo AS pet_tipo,
              ps.nome AS petshop_nome, ps.endereco AS petshop_endereco, ps.telefone AS petshop_telefone,
              u.nome AS usuario_nome, u.email AS usuario_email, u.telefone AS usuario_telefone
       FROM agenda_petshop a
       LEFT JOIN pets p ON a.pet_id = p.id
       LEFT JOIN petshops ps ON a.petshop_id = ps.id
       LEFT JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  async buscarPorUsuario(usuarioId) {
    const resultado = await query(
      `SELECT a.*,
              p.nome AS pet_nome, p.tipo AS pet_tipo,
              ps.nome AS petshop_nome, ps.endereco AS petshop_endereco
       FROM agenda_petshop a
       LEFT JOIN pets p ON a.pet_id = p.id
       LEFT JOIN petshops ps ON a.petshop_id = ps.id
       WHERE a.usuario_id = $1
       ORDER BY a.data_agendamento ASC, a.horario ASC`,
      [usuarioId]
    );

    return resultado.rows;
  },

  async buscarPorPetshop(petshopId) {
    const resultado = await query(
      `SELECT a.*,
              p.nome AS pet_nome, p.tipo AS pet_tipo,
              u.nome AS usuario_nome, u.email AS usuario_email, u.telefone AS usuario_telefone
       FROM agenda_petshop a
       LEFT JOIN pets p ON a.pet_id = p.id
       LEFT JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.petshop_id = $1
       ORDER BY a.data_agendamento ASC, a.horario ASC`,
      [petshopId]
    );

    return resultado.rows;
  },

  async atualizar(id, dados) {
    const { servico, data_agendamento, status, horario, observacoes } = dados;

    const resultado = await query(
      `UPDATE agenda_petshop
       SET servico = COALESCE($2, servico),
           data_agendamento = COALESCE($3, data_agendamento),
           status = COALESCE($4, status),
           horario = COALESCE($5, horario),
           observacoes = COALESCE($6, observacoes),
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, servico, data_agendamento, status, horario, observacoes]
    );

    return resultado.rows[0];
  },

  async atualizarStatus(id, status) {
    const resultado = await query(
      `UPDATE agenda_petshop
       SET status = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );

    return resultado.rows[0];
  },

  async cancelar(id) {
    const resultado = await query(
      `UPDATE agenda_petshop
       SET status = 'cancelado',
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  async confirmar(id) {
    const resultado = await query(
      `UPDATE agenda_petshop
       SET status = 'confirmado',
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  async concluir(id) {
    const resultado = await query(
      `UPDATE agenda_petshop
       SET status = 'concluido',
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  async contarPorStatus(status) {
    const resultado = await query(
      `SELECT COUNT(*)::int AS total
       FROM agenda_petshop
       WHERE status = $1`,
      [status]
    );

    return resultado.rows[0];
  },
};

module.exports = AgendaPetshop;
