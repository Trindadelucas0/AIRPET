/**
 * Petshop.js — Modelo de dados para a tabela "petshops"
 *
 * Este módulo gerencia os petshops parceiros cadastrados no sistema.
 * Utiliza PostGIS para armazenar e consultar localizações geográficas,
 * permitindo buscar petshops próximos a uma coordenada.
 *
 * Tabela: petshops
 * Campos principais: id, nome, endereco, cidade, estado, cep,
 *                    telefone, email, latitude, longitude,
 *                    localizacao (geography), ativo, data_criacao
 */

const { query } = require('../config/database');

const Petshop = {

  /**
   * Cadastra um novo petshop parceiro.
   * A localização é armazenada como geography (PostGIS) para
   * permitir buscas por proximidade usando ST_DWithin.
   *
   * @param {object} dados - Dados do petshop
   * @param {string} dados.nome - Nome do estabelecimento
   * @param {string} dados.endereco - Endereço completo
   * @param {string} dados.cidade - Cidade
   * @param {string} dados.estado - Estado (UF)
   * @param {string} dados.cep - CEP
   * @param {string} dados.telefone - Telefone de contato
   * @param {string} dados.email - E-mail do petshop
   * @param {number} dados.latitude - Latitude do petshop
   * @param {number} dados.longitude - Longitude do petshop
   * @returns {Promise<object>} O registro do petshop criado
   */
  async criar(dados) {
    const {
      nome, endereco, cidade, estado, cep,
      telefone, email, latitude, longitude
    } = dados;

    const resultado = await query(
      `INSERT INTO petshops
        (nome, endereco, cidade, estado, cep, telefone, email, latitude, longitude, localizacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography)
       RETURNING *`,
      [nome, endereco, cidade, estado, cep, telefone, email, latitude, longitude]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um petshop pelo seu ID.
   *
   * @param {string} id - UUID do petshop
   * @returns {Promise<object|undefined>} O petshop encontrado ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM petshops WHERE id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  async buscarPorSlug(slug) {
    const resultado = await query(
      `SELECT * FROM petshops WHERE slug = $1`,
      [slug]
    );
    return resultado.rows[0];
  },

  /**
   * Lista apenas os petshops ativos (ativo = true).
   * Exibidos no mapa público e nas buscas de parceiros.
   *
   * @returns {Promise<Array>} Lista de petshops ativos
   */
  async listarAtivos() {
    const resultado = await query(
      `SELECT * FROM petshops WHERE ativo = true ORDER BY nome ASC`
    );

    return resultado.rows;
  },

  /**
   * Lista todos os petshops (ativos e inativos).
   * Usado no painel administrativo.
   *
   * @returns {Promise<Array>} Lista completa de petshops
   */
  async listarTodos() {
    const resultado = await query(
      `SELECT * FROM petshops ORDER BY data_criacao DESC`
    );

    return resultado.rows;
  },

  /**
   * Atualiza os dados cadastrais de um petshop.
   * Recalcula a coluna geography se lat/lng forem alterados.
   *
   * @param {string} id - UUID do petshop
   * @param {object} dados - Campos a serem atualizados
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizar(id, dados) {
    const {
      nome, endereco, cidade, estado, cep,
      telefone, email, latitude, longitude
    } = dados;

    const resultado = await query(
      `UPDATE petshops
       SET nome = $2,
           endereco = $3,
           cidade = $4,
           estado = $5,
           cep = $6,
           telefone = $7,
           email = $8,
           latitude = $9,
           longitude = $10,
           localizacao = ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nome, endereco, cidade, estado, cep, telefone, email, latitude, longitude]
    );

    return resultado.rows[0];
  },

  /**
   * Remove um petshop do banco de dados.
   *
   * @param {string} id - UUID do petshop
   * @returns {Promise<object|undefined>} O registro removido ou undefined
   */
  async deletar(id) {
    const resultado = await query(
      `DELETE FROM petshops WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Busca petshops próximos a uma coordenada geográfica.
   * Utiliza ST_DWithin do PostGIS para encontrar petshops
   * dentro de um raio em metros. Retorna ordenados por distância.
   *
   * @param {number} lat - Latitude do ponto de referência
   * @param {number} lng - Longitude do ponto de referência
   * @param {number} raioMetros - Raio de busca em metros (ex: 5000 = 5km)
   * @returns {Promise<Array>} Petshops dentro do raio, ordenados por distância
   */
  async buscarProximos(lat, lng, raioMetros) {
    /* ST_MakePoint recebe (longitude, latitude) — cuidado com a ordem! */
    const resultado = await query(
      `SELECT *,
              ST_Distance(
                localizacao,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
              ) AS distancia_metros
       FROM petshops
       WHERE ativo = true
         AND ST_DWithin(
               localizacao,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )
       ORDER BY distancia_metros ASC`,
      [lat, lng, raioMetros]
    );

    return resultado.rows;
  },

  /**
   * Conta o número total de petshops cadastrados.
   *
   * @returns {Promise<number>} Total de petshops
   */
  async contarTotal() {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM petshops`
    );

    return parseInt(resultado.rows[0].total, 10);
  },
};

module.exports = Petshop;
