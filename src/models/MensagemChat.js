/**
 * MensagemChat.js — Modelo de dados para a tabela "mensagens_chat"
 *
 * Este módulo gerencia as mensagens individuais dentro das conversas.
 * Todas as mensagens passam por moderação antes de serem exibidas:
 *   pendente → aprovada ou rejeitada
 *
 * Tabela: mensagens_chat
 * Campos principais: id, conversa_id, remetente_id, conteudo,
 *                    tipo, status_moderacao, moderado_por,
 *                    moderado_em, data_criacao
 */

const { query, pool } = require('../config/database');

const MensagemChat = {

  /**
   * Cria uma nova mensagem em uma conversa.
   * A mensagem inicia com status_moderacao = 'pendente'
   * e só aparece para o destinatário após aprovação do admin.
   *
   * @param {object} dados - Dados da mensagem
   * @param {string} dados.conversa_id - UUID da conversa
   * @param {string} dados.remetente_id - UUID de quem enviou
   * @param {string} dados.conteudo - Texto da mensagem
   * @param {string} dados.tipo - Tipo da mensagem ('texto', 'imagem', 'localizacao')
   * @returns {Promise<object>} O registro da mensagem criada
   */
  async criar(dados) {
    const { conversa_id, remetente, conteudo, tipo, foto_url } = dados;

    const resultado = await query(
      `INSERT INTO mensagens_chat (conversa_id, remetente, conteudo, tipo, foto_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [conversa_id, remetente, conteudo || '', tipo || 'texto', foto_url || null]
    );

    return resultado.rows[0];
  },

  /**
   * Busca todas as mensagens APROVADAS de uma conversa.
   * Ordena pela data de criação (ASC) para exibir na ordem cronológica.
   * Mensagens pendentes ou rejeitadas não são retornadas.
   *
   * @param {string} conversaId - UUID da conversa
   * @returns {Promise<Array>} Mensagens aprovadas da conversa
   */
  async buscarPorConversa(conversaId) {
    const resultado = await query(
      `SELECT mc.*
       FROM mensagens_chat mc
       WHERE mc.conversa_id = $1
         AND mc.status_moderacao = 'aprovada'
       ORDER BY mc.data ASC`,
      [conversaId]
    );

    return resultado.rows;
  },

  /**
   * Lista todas as mensagens pendentes de moderação.
   * O admin usa esta lista para aprovar ou rejeitar mensagens.
   * Ordena por data ASC para moderar na ordem de chegada (FIFO).
   *
   * @returns {Promise<Array>} Mensagens pendentes de moderação
   */
  async buscarPendentes() {
    const resultado = await query(
      `SELECT mc.*,
              u.nome AS remetente_nome
       FROM mensagens_chat mc
       LEFT JOIN usuarios u ON u.id::text = mc.remetente
       WHERE mc.status_moderacao = 'pendente'
       ORDER BY mc.data ASC`
    );

    return resultado.rows;
  },

  /**
   * Aprova uma mensagem, tornando-a visível na conversa.
   * Registra qual admin aprovou e quando.
   *
   * @param {string} id - UUID da mensagem
   * @param {string} adminId - UUID do admin que aprovou
   * @returns {Promise<object>} Mensagem atualizada
   */
  async aprovar(id, adminId) {
    const resultado = await query(
      `UPDATE mensagens_chat
       SET status_moderacao = 'aprovada',
           moderado_por = $2,
           moderado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, adminId]
    );

    return resultado.rows[0];
  },

  /**
   * Rejeita uma mensagem (conteúdo inadequado, spam, etc.).
   * A mensagem não será exibida na conversa.
   *
   * @param {string} id - UUID da mensagem
   * @param {string} adminId - UUID do admin que rejeitou
   * @returns {Promise<object>} Mensagem atualizada
   */
  async rejeitar(id, adminId) {
    const resultado = await query(
      `UPDATE mensagens_chat
       SET status_moderacao = 'rejeitada',
           moderado_por = $2,
           moderado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, adminId]
    );

    return resultado.rows[0];
  },

  /**
   * Remove todas as mensagens de uma conversa.
   * Usado quando o alerta de pet perdido é resolvido
   * e a conversa pode ser limpa (LGPD / retenção de dados).
   *
   * @param {string} conversaId - UUID da conversa
   * @returns {Promise<number>} Número de mensagens removidas
   */
  async deletarPorConversa(conversaId, client = null) {
    const executor = client || pool;
    const resultado = await executor.query(
      `DELETE FROM mensagens_chat
       WHERE conversa_id = $1`,
      [conversaId]
    );

    return resultado.rowCount;
  },

  /**
   * Conta o total de mensagens pendentes de moderação.
   * Exibido como badge no painel do admin.
   *
   * @returns {Promise<number>} Número de mensagens pendentes
   */
  async contarPendentes() {
    const resultado = await query(
      `SELECT COUNT(*) AS total
       FROM mensagens_chat
       WHERE status_moderacao = 'pendente'`
    );

    return parseInt(resultado.rows[0].total, 10);
  },
};

module.exports = MensagemChat;
