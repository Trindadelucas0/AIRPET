/**
 * Vacina.js — Modelo de dados para a tabela "vacinas"
 *
 * Este módulo gerencia o histórico de vacinação dos pets.
 * Permite registrar vacinas aplicadas, datas de reforço
 * e emitir alertas quando vacinas estão próximas de vencer.
 *
 * Tabela: vacinas
 * Campos principais: id, pet_id, nome_vacina, data_aplicacao,
 *                    data_proxima, veterinario, clinica,
 *                    observacoes, data_criacao
 */

const { query } = require('../config/database');

const Vacina = {

  /**
   * Registra uma nova vacina aplicada em um pet.
   *
   * @param {object} dados - Dados da vacina
   * @param {string} dados.pet_id - UUID do pet vacinado
   * @param {string} dados.nome_vacina - Nome da vacina (ex: 'V10', 'Antirrábica')
   * @param {string} dados.data_aplicacao - Data em que a vacina foi aplicada
   * @param {string} dados.data_proxima - Data prevista para o próximo reforço
   * @param {string} dados.veterinario - Nome do veterinário que aplicou
   * @param {string} dados.clinica - Nome da clínica/petshop
   * @param {string} dados.observacoes - Observações adicionais
   * @returns {Promise<object>} O registro da vacina criada
   */
  async criar(dados) {
    const {
      pet_id, nome_vacina, data_aplicacao,
      data_proxima, veterinario, clinica, observacoes
    } = dados;

    const resultado = await query(
      `INSERT INTO vacinas
        (pet_id, nome_vacina, data_aplicacao, data_proxima, veterinario, clinica, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pet_id, nome_vacina, data_aplicacao, data_proxima, veterinario, clinica, observacoes]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todas as vacinas de um pet, da mais recente à mais antiga.
   * Monta o cartão de vacinação digital do pet.
   *
   * @param {string} petId - UUID do pet
   * @returns {Promise<Array>} Histórico de vacinas do pet
   */
  async buscarPorPet(petId) {
    const resultado = await query(
      `SELECT * FROM vacinas
       WHERE pet_id = $1
       ORDER BY data_aplicacao DESC`,
      [petId]
    );

    return resultado.rows;
  },

  async buscarPorIdComUsuarioDono(id) {
    const resultado = await query(
      `SELECT v.*, p.usuario_id FROM vacinas v JOIN pets p ON p.id = v.pet_id WHERE v.id = $1`,
      [id]
    );
    return resultado.rows[0] || null;
  },

  /**
   * Atualiza os dados de uma vacina registrada.
   *
   * @param {string} id - UUID da vacina
   * @param {object} dados - Campos a serem atualizados
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizar(id, dados) {
    const {
      nome_vacina, data_aplicacao, data_proxima,
      veterinario, clinica, observacoes
    } = dados;

    const resultado = await query(
      `UPDATE vacinas
       SET nome_vacina = $2,
           data_aplicacao = $3,
           data_proxima = $4,
           veterinario = $5,
           clinica = $6,
           observacoes = $7
       WHERE id = $1
       RETURNING *`,
      [id, nome_vacina, data_aplicacao, data_proxima, veterinario, clinica, observacoes]
    );

    return resultado.rows[0];
  },

  /**
   * Remove um registro de vacina do banco.
   *
   * @param {string} id - UUID da vacina
   * @returns {Promise<object|undefined>} O registro removido ou undefined
   */
  async deletar(id) {
    const resultado = await query(
      `DELETE FROM vacinas WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Busca vacinas que estão próximas de vencer (reforço necessário).
   * Compara a data_proxima com o intervalo NOW() até NOW() + N dias.
   * Usado pelo sistema de notificações para alertar os tutores.
   *
   * @param {number} diasAntecedencia - Quantos dias antes do vencimento alertar (ex: 30)
   * @returns {Promise<Array>} Vacinas prestes a vencer com dados do pet
   */
  async buscarVencendo(diasAntecedencia) {
    const resultado = await query(
      `SELECT v.*, p.nome AS pet_nome, p.usuario_id
       FROM vacinas v
       JOIN pets p ON p.id = v.pet_id
       WHERE v.data_proxima BETWEEN NOW() AND NOW() + ($1 || ' days')::interval
       ORDER BY v.data_proxima ASC`,
      [diasAntecedencia]
    );

    return resultado.rows;
  },
};

module.exports = Vacina;
