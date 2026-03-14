/**
 * Pet.js — Modelo de dados para a tabela "pets"
 *
 * Este módulo encapsula todas as operações de banco de dados
 * relacionadas aos pets cadastrados no sistema AIRPET.
 * Cada pet pertence a um usuário (dono/tutor).
 *
 * Tabela: pets
 * Campos principais: id, usuario_id, nome, especie, raca, cor,
 *                    porte, sexo, idade, peso, foto, descricao,
 *                    status, data_criacao, data_atualizacao
 */

const { query } = require('../config/database');

const Pet = {

  /**
   * Cadastra um novo pet no sistema.
   * O campo usuario_id vincula o pet ao seu dono/tutor.
   *
   * @param {object} dados - Dados do pet a ser criado
   * @param {string} dados.usuario_id - UUID do dono/tutor
   * @param {string} dados.nome - Nome do pet
   * @param {string} dados.especie - Espécie (ex: 'cachorro', 'gato')
   * @param {string} dados.raca - Raça do pet
   * @param {string} dados.cor - Cor predominante
   * @param {string} dados.porte - Porte (pequeno, médio, grande)
   * @param {string} dados.sexo - Sexo ('macho' ou 'fêmea')
   * @param {number} dados.idade - Idade em anos
   * @param {number} dados.peso - Peso em kg
   * @param {string} dados.foto - Caminho da foto do pet
   * @param {string} dados.descricao - Descrição livre / observações
   * @returns {Promise<object>} O registro do pet recém-criado
   */
  async criar(dados) {
    const {
      usuario_id, nome, tipo, tipo_custom, raca, cor,
      porte, sexo, data_nascimento, peso, foto, descricao_emocional, telefone_contato
    } = dados;

    const resultado = await query(
      `INSERT INTO pets
        (usuario_id, nome, tipo, tipo_custom, raca, cor, porte, sexo, data_nascimento, peso, foto, descricao_emocional, telefone_contato)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [usuario_id, nome, tipo, tipo_custom, raca, cor, porte, sexo, data_nascimento, peso, foto, descricao_emocional, telefone_contato]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um pet pelo ID, incluindo o nome do dono via JOIN.
   * Retorna também o campo "dono_nome" para exibição na interface.
   *
   * @param {string} id - UUID do pet
   * @returns {Promise<object|undefined>} Pet com dados do dono ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT p.*, u.nome AS dono_nome
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todos os pets de um determinado usuário/tutor.
   * Ordena pela data de criação do mais recente para o mais antigo.
   *
   * @param {string} usuarioId - UUID do dono/tutor
   * @returns {Promise<Array>} Lista de pets do usuário
   */
  async buscarPorUsuario(usuarioId) {
    const resultado = await query(
      `SELECT * FROM pets
       WHERE usuario_id = $1
       ORDER BY data_criacao DESC`,
      [usuarioId]
    );

    return resultado.rows;
  },

  /**
   * Lista todos os pets do sistema com o nome do dono.
   * Usado no painel administrativo para visualizar todos os animais.
   *
   * @returns {Promise<Array>} Lista de todos os pets com nome do dono
   */
  async listarTodos() {
    const resultado = await query(
      `SELECT p.*, u.nome AS dono_nome
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.data_criacao DESC`
    );

    return resultado.rows;
  },

  /**
   * Atualiza os dados cadastrais de um pet.
   *
   * @param {string} id - UUID do pet
   * @param {object} dados - Campos a serem atualizados
   * @returns {Promise<object>} O registro atualizado do pet
   */
  async atualizar(id, dados) {
    const {
      nome, tipo, tipo_custom, raca, cor,
      porte, sexo, data_nascimento, peso, descricao_emocional, telefone_contato
    } = dados;

    const resultado = await query(
      `UPDATE pets
       SET nome = $2,
           tipo = $3,
           tipo_custom = $4,
           raca = $5,
           cor = $6,
           porte = $7,
           sexo = $8,
           data_nascimento = $9,
           peso = $10,
           descricao_emocional = $11,
           telefone_contato = $12,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nome, tipo, tipo_custom, raca, cor, porte, sexo, data_nascimento, peso, descricao_emocional, telefone_contato]
    );

    return resultado.rows[0];
  },

  /**
   * Atualiza apenas o status do pet.
   * Status possíveis: 'seguro' (padrão) ou 'perdido'.
   * Quando um pet é marcado como 'perdido', fluxos de alerta são acionados.
   *
   * @param {string} id - UUID do pet
   * @param {string} status - Novo status ('seguro' ou 'perdido')
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizarStatus(id, status) {
    const resultado = await query(
      `UPDATE pets
       SET status = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );

    return resultado.rows[0];
  },

  /**
   * Atualiza a foto de perfil do pet.
   * O caminho da foto é relativo ao diretório de uploads.
   *
   * @param {string} id - UUID do pet
   * @param {string} fotoPath - Novo caminho da foto
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizarFoto(id, fotoPath) {
    const resultado = await query(
      `UPDATE pets
       SET foto = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, fotoPath]
    );

    return resultado.rows[0];
  },

  /**
   * Remove permanentemente um pet do banco de dados.
   *
   * @param {string} id - UUID do pet
   * @returns {Promise<object|undefined>} O registro removido ou undefined
   */
  async deletar(id) {
    const resultado = await query(
      `DELETE FROM pets WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Conta o número total de pets cadastrados no sistema.
   *
   * @returns {Promise<number>} Total de pets
   */
  async contarTotal() {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM pets`
    );

    return parseInt(resultado.rows[0].total, 10);
  },

  /**
   * Conta quantos pets estão com status 'perdido'.
   * Usado no dashboard para exibir alertas ativos.
   *
   * @returns {Promise<number>} Número de pets perdidos
   */
  async contarPerdidos() {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM pets WHERE status = 'perdido'`
    );

    return parseInt(resultado.rows[0].total, 10);
  },
};

module.exports = Pet;
