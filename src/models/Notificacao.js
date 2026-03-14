/**
 * Notificacao.js — Modelo de dados para a tabela "notificacoes"
 *
 * Este módulo gerencia as notificações enviadas aos usuários.
 * Notificações informam sobre eventos como: pet encontrado,
 * nova mensagem no chat, alerta de pet perdido na região, etc.
 *
 * Tabela: notificacoes
 * Campos principais: id, usuario_id, tipo, mensagem, link,
 *                    lida, data_criacao
 */

const { query, getClient } = require('../config/database');

const Notificacao = {

  /**
   * Cria uma notificação para um único usuário.
   *
   * @param {object} dados - Dados da notificação
   * @param {string} dados.usuario_id - UUID do usuário destinatário
   * @param {string} dados.tipo - Tipo da notificação (ex: 'alerta', 'chat', 'sistema')
   * @param {string} dados.mensagem - Texto da notificação
   * @param {string} dados.link - Link de ação (ex: '/pet-perdido/uuid')
   * @returns {Promise<object>} O registro da notificação criada
   */
  async criar(dados) {
    const { usuario_id, tipo, mensagem, link } = dados;

    const resultado = await query(
      `INSERT INTO notificacoes (usuario_id, tipo, mensagem, link)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [usuario_id, tipo, mensagem, link]
    );

    return resultado.rows[0];
  },

  /**
   * Cria a mesma notificação para múltiplos usuários de uma vez.
   * Utiliza unnest do PostgreSQL para inserção em massa eficiente.
   * Todos os usuários recebem a mesma mensagem, tipo e link.
   *
   * @param {Array<string>} usuarioIds - Lista de UUIDs dos destinatários
   * @param {string} tipo - Tipo da notificação
   * @param {string} mensagem - Texto da notificação
   * @param {string} link - Link de ação
   * @returns {Promise<Array>} Lista de notificações criadas
   */
  async criarParaMultiplos(usuarioIds, tipo, mensagem, link) {
    /*
     * Usa unnest para transformar o array de UUIDs em múltiplas linhas,
     * evitando N queries individuais (muito mais performático).
     */
    const resultado = await query(
      `INSERT INTO notificacoes (usuario_id, tipo, mensagem, link)
       SELECT unnest($1::uuid[]), $2, $3, $4
       RETURNING *`,
      [usuarioIds, tipo, mensagem, link]
    );

    return resultado.rows;
  },

  /**
   * Busca todas as notificações de um usuário.
   * Ordena da mais recente para a mais antiga.
   *
   * @param {string} usuarioId - UUID do usuário
   * @returns {Promise<Array>} Notificações do usuário
   */
  async buscarPorUsuario(usuarioId) {
    const resultado = await query(
      `SELECT * FROM notificacoes
       WHERE usuario_id = $1
       ORDER BY data_criacao DESC`,
      [usuarioId]
    );

    return resultado.rows;
  },

  /**
   * Marca uma notificação como lida.
   * Atualiza o campo 'lida' de false para true.
   *
   * @param {string} id - UUID da notificação
   * @returns {Promise<object>} Notificação atualizada
   */
  async marcarComoLida(id) {
    const resultado = await query(
      `UPDATE notificacoes
       SET lida = true
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Conta quantas notificações não lidas um usuário possui.
   * Usado para exibir o badge/contador na interface.
   *
   * @param {string} usuarioId - UUID do usuário
   * @returns {Promise<number>} Número de notificações não lidas
   */
  async contarNaoLidas(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*) AS total
       FROM notificacoes
       WHERE usuario_id = $1 AND lida = false`,
      [usuarioId]
    );

    return parseInt(resultado.rows[0].total, 10);
  },
};

module.exports = Notificacao;
