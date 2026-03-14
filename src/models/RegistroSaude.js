/**
 * RegistroSaude.js — Modelo de dados para a tabela "registros_saude"
 *
 * Este módulo gerencia os registros de saúde dos pets.
 * Inclui consultas veterinárias, exames, cirurgias, vermífugos,
 * antipulgas e qualquer outro evento de saúde relevante.
 *
 * Tabela: registros_saude
 * Campos principais: id, pet_id, tipo, descricao, data_registro,
 *                    veterinario, clinica, observacoes, data_criacao
 */

const { query } = require('../config/database');

const RegistroSaude = {

  /**
   * Cria um novo registro de saúde para um pet.
   *
   * @param {object} dados - Dados do registro
   * @param {string} dados.pet_id - UUID do pet
   * @param {string} dados.tipo - Tipo do registro (ex: 'consulta', 'exame', 'cirurgia', 'vermifugo')
   * @param {string} dados.descricao - Descrição do procedimento/evento
   * @param {string} dados.data_registro - Data do evento de saúde
   * @param {string} dados.veterinario - Nome do veterinário responsável
   * @param {string} dados.clinica - Nome da clínica/hospital
   * @param {string} dados.observacoes - Observações adicionais
   * @returns {Promise<object>} O registro de saúde criado
   */
  async criar(dados) {
    const {
      pet_id, tipo, descricao, data_registro,
      veterinario, clinica, observacoes
    } = dados;

    const resultado = await query(
      `INSERT INTO registros_saude
        (pet_id, tipo, descricao, data_registro, veterinario, clinica, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pet_id, tipo, descricao, data_registro, veterinario, clinica, observacoes]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todos os registros de saúde de um pet.
   * Ordena do mais recente para o mais antigo.
   *
   * @param {string} petId - UUID do pet
   * @returns {Promise<Array>} Histórico de saúde do pet
   */
  async buscarPorPet(petId) {
    const resultado = await query(
      `SELECT * FROM registros_saude
       WHERE pet_id = $1
       ORDER BY data_registro DESC`,
      [petId]
    );

    return resultado.rows;
  },

  /**
   * Lista registros de saúde de um pet filtrados por tipo.
   * Útil para ver apenas consultas, apenas exames, etc.
   *
   * @param {string} petId - UUID do pet
   * @param {string} tipo - Tipo de registro para filtrar
   * @returns {Promise<Array>} Registros filtrados por tipo
   */
  async buscarPorTipo(petId, tipo) {
    const resultado = await query(
      `SELECT * FROM registros_saude
       WHERE pet_id = $1 AND tipo = $2
       ORDER BY data_registro DESC`,
      [petId, tipo]
    );

    return resultado.rows;
  },

  /**
   * Atualiza os dados de um registro de saúde.
   *
   * @param {string} id - UUID do registro
   * @param {object} dados - Campos a serem atualizados
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizar(id, dados) {
    const {
      tipo, descricao, data_registro,
      veterinario, clinica, observacoes
    } = dados;

    const resultado = await query(
      `UPDATE registros_saude
       SET tipo = $2,
           descricao = $3,
           data_registro = $4,
           veterinario = $5,
           clinica = $6,
           observacoes = $7
       WHERE id = $1
       RETURNING *`,
      [id, tipo, descricao, data_registro, veterinario, clinica, observacoes]
    );

    return resultado.rows[0];
  },

  /**
   * Remove um registro de saúde do banco.
   *
   * @param {string} id - UUID do registro
   * @returns {Promise<object|undefined>} O registro removido ou undefined
   */
  async deletar(id) {
    const resultado = await query(
      `DELETE FROM registros_saude WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },
};

module.exports = RegistroSaude;
