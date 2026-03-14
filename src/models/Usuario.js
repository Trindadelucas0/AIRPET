/**
 * Usuario.js — Modelo de dados para a tabela "usuarios"
 *
 * Este módulo encapsula todas as operações de banco de dados
 * relacionadas aos usuários do sistema AIRPET.
 * Cada método utiliza queries parametrizadas ($1, $2...)
 * para prevenir ataques de SQL Injection.
 *
 * Tabela: usuarios
 * Campos principais: id, nome, email, senha_hash, telefone, role,
 *                    ultima_lat, ultima_lng, ultima_localizacao,
 *                    data_criacao, data_atualizacao
 */

const { query } = require('../config/database');

const Usuario = {

  /**
   * Cria um novo usuário no banco de dados.
   *
   * @param {object} dados - Objeto com os dados do novo usuário
   * @param {string} dados.nome - Nome completo do usuário
   * @param {string} dados.email - E-mail (deve ser único na tabela)
   * @param {string} dados.senha_hash - Senha já criptografada com bcrypt
   * @param {string} dados.telefone - Telefone de contato
   * @param {string} dados.role - Papel do usuário ('tutor' ou 'admin')
   * @returns {Promise<object>} O registro do usuário recém-criado
   */
  async criar(dados) {
    const { nome, email, senha_hash, telefone, role } = dados;

    const resultado = await query(
      `INSERT INTO usuarios (nome, email, senha_hash, telefone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nome, email, senha_hash, telefone, role]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um usuário pelo endereço de e-mail.
   * Usado principalmente no fluxo de login/autenticação.
   *
   * @param {string} email - E-mail a ser pesquisado
   * @returns {Promise<object|undefined>} O usuário encontrado ou undefined
   */
  async buscarPorEmail(email) {
    const resultado = await query(
      `SELECT * FROM usuarios WHERE email = $1`,
      [email]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um usuário pelo seu ID (chave primária UUID).
   *
   * @param {string} id - UUID do usuário
   * @returns {Promise<object|undefined>} O usuário encontrado ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM usuarios WHERE id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todos os usuários cadastrados no sistema.
   * Ordena do mais recente para o mais antigo (data_criacao DESC).
   *
   * @returns {Promise<Array>} Lista de todos os usuários
   */
  async listarTodos() {
    const resultado = await query(
      `SELECT * FROM usuarios ORDER BY data_criacao DESC`
    );

    return resultado.rows;
  },

  /**
   * Atualiza a localização geográfica de um usuário.
   * Utiliza PostGIS para armazenar o ponto geográfico (SRID 4326 = WGS84).
   * Isso permite consultas espaciais como "encontrar usuários próximos".
   *
   * @param {string} id - UUID do usuário
   * @param {number} lat - Latitude (ex: -23.5505)
   * @param {number} lng - Longitude (ex: -46.6333)
   * @returns {Promise<object>} O registro atualizado do usuário
   */
  async atualizarLocalizacao(id, lat, lng) {
    const resultado = await query(
      `UPDATE usuarios
       SET ultima_lat = $2,
           ultima_lng = $3,
           ultima_localizacao = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, lat, lng]
    );

    return resultado.rows[0];
  },

  /**
   * Conta o número total de usuários cadastrados.
   * Útil para o painel administrativo (dashboard).
   *
   * @returns {Promise<number>} Total de usuários
   */
  async contarTotal() {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM usuarios`
    );

    return parseInt(resultado.rows[0].total, 10);
  },

  /**
   * Atualiza os dados básicos de um usuário (nome, email, telefone).
   * Não altera a senha nem o papel — esses têm métodos específicos.
   *
   * @param {string} id - UUID do usuário
   * @param {object} dados - Campos a serem atualizados
   * @param {string} dados.nome - Novo nome
   * @param {string} dados.email - Novo e-mail
   * @param {string} dados.telefone - Novo telefone
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizar(id, dados) {
    const { nome, email, telefone } = dados;

    const resultado = await query(
      `UPDATE usuarios
       SET nome = $2,
           email = $3,
           telefone = $4,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nome, email, telefone]
    );

    return resultado.rows[0];
  },

  /**
   * Remove permanentemente um usuário do banco de dados.
   * ATENÇÃO: esta operação é irreversível. Considerar soft delete no futuro.
   *
   * @param {string} id - UUID do usuário a ser removido
   * @returns {Promise<object|undefined>} O registro removido ou undefined
   */
  async atualizarPerfil(id, dados) {
    const { nome, telefone, cor_perfil } = dados;
    const resultado = await query(
      `UPDATE usuarios SET nome = $2, telefone = $3, cor_perfil = $4, data_atualizacao = NOW() WHERE id = $1 RETURNING *`,
      [id, nome, telefone, cor_perfil || '#ec5a1c']
    );
    return resultado.rows[0];
  },

  async atualizarRole(id, role) {
    const resultado = await query(
      `UPDATE usuarios SET role = $2, data_atualizacao = NOW() WHERE id = $1 RETURNING *`,
      [id, role]
    );
    return resultado.rows[0];
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM usuarios WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },
};

module.exports = Usuario;
