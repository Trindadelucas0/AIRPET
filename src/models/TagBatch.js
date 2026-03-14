/**
 * TagBatch.js — Modelo de dados para a tabela "tag_batches"
 *
 * Este módulo gerencia os lotes de fabricação de tags NFC.
 * Cada lote agrupa N tags que foram fabricadas juntas,
 * permitindo rastreabilidade e controle de estoque.
 *
 * Tabela: tag_batches
 * Campos principais: id, codigo_lote, quantidade, fabricante,
 *                    observacoes, criado_por, data_criacao
 */

const { query } = require('../config/database');

const TagBatch = {

  /**
   * Registra um novo lote de tags no sistema.
   *
   * @param {object} dados - Dados do lote
   * @param {string} dados.codigo_lote - Código identificador do lote (ex: 'LOTE-2024-001')
   * @param {number} dados.quantidade - Quantidade de tags no lote
   * @param {string} dados.fabricante - Nome do fabricante das tags
   * @param {string} dados.observacoes - Observações adicionais sobre o lote
   * @param {string} dados.criado_por - UUID do admin que cadastrou o lote
   * @returns {Promise<object>} O registro do lote recém-criado
   */
  async criar(dados) {
    const { codigo_lote, quantidade, fabricante, observacoes, criado_por } = dados;

    const resultado = await query(
      `INSERT INTO tag_batches (codigo_lote, quantidade, fabricante, observacoes, criado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [codigo_lote, quantidade, fabricante, observacoes, criado_por]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um lote pelo seu ID (chave primária).
   *
   * @param {string} id - UUID do lote
   * @returns {Promise<object|undefined>} O lote encontrado ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM tag_batches WHERE id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todos os lotes cadastrados.
   * Ordena do mais recente para o mais antigo.
   *
   * @returns {Promise<Array>} Lista de lotes
   */
  async listarTodos() {
    const resultado = await query(
      `SELECT * FROM tag_batches ORDER BY data_criacao DESC`
    );

    return resultado.rows;
  },

  /**
   * Busca um lote pelo seu código identificador (codigo_lote).
   * O código do lote é um identificador legível definido pelo admin.
   *
   * @param {string} codigoLote - Código do lote (ex: 'LOTE-2024-001')
   * @returns {Promise<object|undefined>} O lote encontrado ou undefined
   */
  async buscarPorCodigo(codigoLote) {
    const resultado = await query(
      `SELECT * FROM tag_batches WHERE codigo_lote = $1`,
      [codigoLote]
    );

    return resultado.rows[0];
  },
};

module.exports = TagBatch;
