/**
 * ConfigSistema.js — Modelo de dados para a tabela "config_sistema"
 *
 * Este módulo gerencia as configurações globais do sistema AIRPET.
 * As configurações são armazenadas como pares chave-valor,
 * permitindo alterar comportamentos sem deploy (ex: raio de busca,
 * limites de upload, textos de notificação, etc.).
 *
 * Tabela: config_sistema
 * Campos principais: id, chave, valor, descricao, atualizado_em
 */

const { query } = require('../config/database');

const ConfigSistema = {

  /**
   * Busca o valor de uma configuração pela sua chave.
   * Retorna apenas o campo 'valor' para uso direto.
   *
   * @param {string} chave - Nome da configuração (ex: 'raio_busca_metros')
   * @returns {Promise<string|undefined>} Valor da configuração ou undefined
   */
  async buscarPorChave(chave) {
    const resultado = await query(
      `SELECT valor FROM config_sistema WHERE chave = $1`,
      [chave]
    );

    /* Retorna diretamente o valor (string) ou undefined se não existir */
    return resultado.rows[0]?.valor;
  },

  /**
   * Atualiza o valor de uma configuração existente.
   * Também atualiza o timestamp de 'atualizado_em'.
   *
   * @param {string} chave - Nome da configuração
   * @param {string} valor - Novo valor a ser definido
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizar(chave, valor) {
    const resultado = await query(
      `UPDATE config_sistema
       SET valor = $2,
           atualizado_em = NOW()
       WHERE chave = $1
       RETURNING *`,
      [chave, valor]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todas as configurações do sistema.
   * Usado no painel administrativo para visualização e edição.
   *
   * @returns {Promise<Array>} Todas as configurações
   */
  async listarTodas() {
    const resultado = await query(
      `SELECT * FROM config_sistema ORDER BY chave ASC`
    );

    return resultado.rows;
  },
};

module.exports = ConfigSistema;
