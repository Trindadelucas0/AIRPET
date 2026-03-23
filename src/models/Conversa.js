/**
 * Conversa.js — Modelo de dados para a tabela "conversas"
 *
 * Este módulo gerencia as conversas de chat do sistema.
 * Uma conversa é aberta quando alguém encontra um pet perdido
 * e deseja se comunicar com o tutor. As mensagens da conversa
 * são gerenciadas pelo modelo MensagemChat.
 *
 * Tabela: conversas
 * Campos principais: id, pet_perdido_id, iniciador_id,
 *                    tutor_id, status, data_criacao
 */

const { query, pool } = require('../config/database');

const Conversa = {

  /**
   * Cria uma nova conversa entre o encontrador e o tutor do pet.
   *
   * @param {object} dados - Dados da conversa
   * @param {string} dados.pet_perdido_id - UUID do alerta de pet perdido
   * @param {string} dados.iniciador_id - UUID de quem encontrou o pet
   * @param {string} dados.tutor_id - UUID do dono/tutor do pet
   * @returns {Promise<object>} O registro da conversa criada
   */
  async criar(dados) {
    const { pet_perdido_id, iniciador_id = null, tutor_id } = dados;

    const resultado = await query(
      `INSERT INTO conversas (pet_perdido_id, iniciador_id, tutor_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [pet_perdido_id, iniciador_id, tutor_id]
    );

    return resultado.rows[0];
  },

  /**
   * Busca uma conversa pelo ID com dados enriquecidos.
   * Traz informações do pet perdido, do iniciador e do tutor
   * via JOINs para exibição completa na interface de chat.
   *
   * @param {string} id - UUID da conversa
   * @returns {Promise<object|undefined>} Conversa com dados completos
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT c.*,
              pp.descricao AS alerta_descricao,
              pp.status AS alerta_status,
              p.nome AS pet_nome,
              p.foto AS pet_foto,
              ini.nome AS iniciador_nome,
              tut.nome AS tutor_nome
       FROM conversas c
       JOIN pets_perdidos pp ON pp.id = c.pet_perdido_id
       JOIN pets p ON p.id = pp.pet_id
       LEFT JOIN usuarios ini ON ini.id = c.iniciador_id
       JOIN usuarios tut ON tut.id = c.tutor_id
       WHERE c.id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Busca todas as conversas relacionadas a um alerta de pet perdido.
   * Um alerta pode gerar múltiplas conversas (várias pessoas encontraram).
   *
   * @param {string} petPerdidoId - UUID do alerta de pet perdido
   * @returns {Promise<Array>} Conversas do alerta
   */
  async buscarPorPetPerdido(petPerdidoId, client = null) {
    const executor = client || pool;
    const resultado = await executor.query(
      `SELECT c.*,
              ini.nome AS iniciador_nome,
              tut.nome AS tutor_nome
       FROM conversas c
       LEFT JOIN usuarios ini ON ini.id = c.iniciador_id
       JOIN usuarios tut ON tut.id = c.tutor_id
       WHERE c.pet_perdido_id = $1
       ORDER BY c.data_criacao DESC`,
      [petPerdidoId]
    );

    return resultado.rows;
  },

  /**
   * Lista conversas em que o usuario participa (iniciador ou tutor).
   *
   * @param {string} usuarioId - ID do usuario
   * @returns {Promise<Array>}
   */
  async buscarPorUsuario(usuarioId) {
    const resultado = await query(
      `SELECT c.*,
              p.nome AS pet_nome,
              p.foto AS pet_foto,
              (SELECT mc.conteudo FROM mensagens_chat mc WHERE mc.conversa_id = c.id AND mc.status_moderacao = 'aprovada' ORDER BY mc.data DESC LIMIT 1) AS ultima_mensagem
       FROM conversas c
       JOIN pets_perdidos pp ON pp.id = c.pet_perdido_id
       JOIN pets p ON p.id = pp.pet_id
       WHERE c.iniciador_id = $1 OR c.tutor_id = $1
       ORDER BY c.data_criacao DESC`,
      [usuarioId]
    );
    return resultado.rows;
  },

  async buscarAtivaPorPetPerdido(petPerdidoId) {
    const resultado = await query(
      `SELECT c.*
       FROM conversas c
       WHERE c.pet_perdido_id = $1
         AND c.status = 'ativa'
       ORDER BY c.data_criacao DESC
       LIMIT 1`,
      [petPerdidoId]
    );
    return resultado.rows[0] || null;
  },

  /**
   * Encerra uma conversa (quando o pet e encontrado ou o problema e resolvido).
   *
   * @param {string} id - UUID da conversa
   * @returns {Promise<object>} Conversa atualizada
   */
  async encerrar(id, client = null) {
    const executor = client || pool;
    const resultado = await executor.query(
      `UPDATE conversas
       SET status = 'encerrada',
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },
};

module.exports = Conversa;
