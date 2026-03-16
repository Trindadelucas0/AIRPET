/**
 * RegiaoNotificacao.js — Modelo para a tabela "regioes_notificacao"
 *
 * Regiões salvas (nome + centro + raio) para reutilizar no envio de notificações em massa.
 */

const { query } = require('../config/database');

const RegiaoNotificacao = {

  async listar() {
    const resultado = await query(
      `SELECT * FROM regioes_notificacao ORDER BY nome ASC`
    );
    return resultado.rows;
  },

  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM regioes_notificacao WHERE id = $1`,
      [id]
    );
    return resultado.rows[0];
  },

  async criar(dados) {
    const { nome, latitude, longitude, raio_km } = dados;
    const resultado = await query(
      `INSERT INTO regioes_notificacao (nome, latitude, longitude, raio_km)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nome, parseFloat(latitude), parseFloat(longitude), parseFloat(raio_km)]
    );
    return resultado.rows[0];
  },

  async atualizar(id, dados) {
    const { nome, latitude, longitude, raio_km } = dados;
    const resultado = await query(
      `UPDATE regioes_notificacao
       SET nome = COALESCE($2, nome),
           latitude = COALESCE($3, latitude),
           longitude = COALESCE($4, longitude),
           raio_km = COALESCE($5, raio_km)
       WHERE id = $1
       RETURNING *`,
      [id, nome, latitude != null ? parseFloat(latitude) : null, longitude != null ? parseFloat(longitude) : null, raio_km != null ? parseFloat(raio_km) : null]
    );
    return resultado.rows[0];
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM regioes_notificacao WHERE id = $1 RETURNING *`,
      [id]
    );
    return resultado.rows[0];
  },
};

module.exports = RegiaoNotificacao;
