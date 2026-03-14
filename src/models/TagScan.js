/**
 * TagScan.js — Modelo de dados para a tabela "tag_scans"
 *
 * Registra cada escaneamento de uma tag NFC.
 * Armazena localizacao GPS, cidade, IP e user agent.
 *
 * Tabela: tag_scans
 * Campos: id, tag_id, tag_code, latitude, longitude, cidade, ip, user_agent, data
 */

const { query } = require('../config/database');

const TagScan = {

  async registrar(dados) {
    const { tag_id, tag_code, latitude, longitude, cidade, ip, user_agent } = dados;

    const resultado = await query(
      `INSERT INTO tag_scans (tag_id, tag_code, latitude, longitude, cidade, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tag_id, tag_code, latitude, longitude, cidade, ip, user_agent]
    );

    return resultado.rows[0];
  },

  async buscarPorTag(tagId) {
    const resultado = await query(
      `SELECT * FROM tag_scans
       WHERE tag_id = $1
       ORDER BY data DESC`,
      [tagId]
    );

    return resultado.rows;
  },

  /**
   * Busca os ultimos N scans de um pet (via JOIN com nfc_tags).
   * Retorna scans com coordenadas validas para exibir no mapa.
   */
  async buscarPorPet(petId, limite = 10) {
    const resultado = await query(
      `SELECT ts.*, t.tag_code
       FROM tag_scans ts
       JOIN nfc_tags t ON t.id = ts.tag_id
       WHERE t.pet_id = $1
         AND ts.latitude IS NOT NULL
         AND ts.longitude IS NOT NULL
       ORDER BY ts.data DESC
       LIMIT $2`,
      [petId, limite]
    );

    return resultado.rows;
  },

  /**
   * Busca o scan mais recente de um pet (com coordenadas).
   */
  async ultimoScanPet(petId) {
    const resultado = await query(
      `SELECT ts.*, t.tag_code
       FROM tag_scans ts
       JOIN nfc_tags t ON t.id = ts.tag_id
       WHERE t.pet_id = $1
         AND ts.latitude IS NOT NULL
         AND ts.longitude IS NOT NULL
       ORDER BY ts.data DESC
       LIMIT 1`,
      [petId]
    );

    return resultado.rows[0] || null;
  },

  async listarRecentes(limite = 50) {
    const resultado = await query(
      `SELECT * FROM tag_scans
       ORDER BY data DESC
       LIMIT $1`,
      [limite]
    );

    return resultado.rows;
  },
};

module.exports = TagScan;
