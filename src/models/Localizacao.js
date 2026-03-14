/**
 * Localizacao.js — Modelo de dados para a tabela "localizacoes"
 *
 * Este módulo gerencia o histórico de localizações dos pets.
 * Cada registro representa um ponto geográfico captado
 * (via scan NFC, GPS do app, etc.) e é armazenado como
 * geography (PostGIS) para consultas espaciais.
 *
 * Tabela: localizacoes
 * Campos principais: id, pet_id, latitude, longitude,
 *                    ponto (geography), origem, data_registro
 */

const { query } = require('../config/database');

const Localizacao = {

  /**
   * Registra uma nova localização para um pet.
   * O ponto geográfico é criado usando ST_MakePoint (SRID 4326 = WGS84).
   *
   * @param {object} dados - Dados da localização
   * @param {string} dados.pet_id - UUID do pet
   * @param {number} dados.latitude - Latitude do ponto
   * @param {number} dados.longitude - Longitude do ponto
   * @param {string} dados.origem - De onde veio o dado ('nfc', 'gps', 'manual')
   * @returns {Promise<object>} O registro de localização criado
   */
  async registrar(dados) {
    const { pet_id, latitude, longitude, origem, cidade, ip, foto_url } = dados;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    const resultado = await query(
      `INSERT INTO localizacoes (pet_id, latitude, longitude, ponto, cidade, ip, foto_url)
       VALUES ($1, $2, $3,
               ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
               $6, $7, $8)
       RETURNING *`,
      [pet_id, lat, lng, lng, lat, cidade || null, ip || null, foto_url || null]
    );

    return resultado.rows[0];
  },

  /**
   * Busca todo o histórico de localizações de um pet.
   * Ordena da mais recente para a mais antiga.
   * Útil para traçar a rota/movimentação do pet no mapa.
   *
   * @param {string} petId - UUID do pet
   * @returns {Promise<Array>} Histórico de localizações do pet
   */
  async buscarPorPet(petId) {
    const resultado = await query(
      `SELECT * FROM localizacoes
       WHERE pet_id = $1
       ORDER BY data DESC`,
      [petId]
    );

    return resultado.rows;
  },

  /**
   * Lista as localizações mais recentes de todos os pets.
   * Aplica um LIMIT para controlar o volume de dados.
   *
   * @param {number} limite - Quantidade máxima de registros (padrão: 100)
   * @returns {Promise<Array>} Localizações mais recentes
   */
  async buscarRecentes(limite = 100) {
    const resultado = await query(
      `SELECT * FROM localizacoes
       ORDER BY data DESC
       LIMIT $1`,
      [limite]
    );

    return resultado.rows;
  },
};

module.exports = Localizacao;
