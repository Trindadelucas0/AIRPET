/**
 * PontoMapa.js — Modelo de dados para a tabela "pontos_mapa"
 *
 * Este módulo gerencia os pontos de interesse exibidos no mapa público.
 * Inclui abrigos, ONGs, clínicas veterinárias, parques pet-friendly, etc.
 * Cada ponto possui uma localização geográfica (PostGIS) e uma categoria.
 *
 * Tabela: pontos_mapa
 * Campos principais: id, nome, descricao, categoria, endereco,
 *                    latitude, longitude, localizacao (geography),
 *                    ativo, data_criacao
 */

const { query } = require('../config/database');

const PontoMapa = {

  /**
   * Cria um novo ponto de interesse no mapa.
   * A localização é armazenada como geography para consultas espaciais.
   *
   * @param {object} dados - Dados do ponto
   * @param {string} dados.nome - Nome do ponto (ex: 'Abrigo São Lázaro')
   * @param {string} dados.descricao - Descrição detalhada
   * @param {string} dados.categoria - Categoria (ex: 'abrigo', 'ong', 'clinica', 'parque')
   * @param {string} dados.endereco - Endereço completo
   * @param {number} dados.latitude - Latitude
   * @param {number} dados.longitude - Longitude
   * @returns {Promise<object>} O registro do ponto criado
   */
  async criar(dados) {
    const { nome, descricao, categoria, endereco, latitude, longitude, telefone, whatsapp, servicos } = dados;

    const resultado = await query(
      `INSERT INTO pontos_mapa
        (nome, descricao, categoria, endereco, latitude, longitude, localizacao, telefone, whatsapp, servicos)
       VALUES ($1, $2, $3, $4, $5, $6,
               ST_SetSRID(ST_MakePoint($10, $11), 4326)::geography,
               $7, $8, $9)
       RETURNING *`,
      [nome, descricao, categoria, endereco, latitude, longitude, telefone, whatsapp, servicos, parseFloat(longitude), parseFloat(latitude)]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um ponto de interesse pelo ID.
   *
   * @param {string} id - UUID do ponto
   * @returns {Promise<object|undefined>} O ponto encontrado ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM pontos_mapa WHERE id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todos os pontos de interesse ativos.
   * Estes são os pontos exibidos no mapa público.
   *
   * @returns {Promise<Array>} Pontos ativos
   */
  async listarAtivos() {
    const resultado = await query(
      `SELECT * FROM pontos_mapa WHERE ativo = true ORDER BY nome ASC`
    );

    return resultado.rows;
  },

  async listarTodos() {
    const resultado = await query(
      `SELECT * FROM pontos_mapa ORDER BY data_criacao DESC`
    );

    return resultado.rows;
  },

  /**
   * Lista pontos de interesse filtrados por categoria.
   *
   * @param {string} categoria - Categoria para filtrar
   * @returns {Promise<Array>} Pontos da categoria
   */
  async listarPorCategoria(categoria) {
    const resultado = await query(
      `SELECT * FROM pontos_mapa
       WHERE categoria = $1 AND ativo = true
       ORDER BY nome ASC`,
      [categoria]
    );

    return resultado.rows;
  },

  /**
   * Busca pontos de interesse dentro de uma bounding box (retângulo geográfico).
   * Usado para carregar pontos visíveis na viewport do mapa do usuário.
   *
   * ST_MakeEnvelope(xmin, ymin, xmax, ymax, SRID) cria um retângulo,
   * e ST_Within verifica se o ponto está dentro dele.
   *
   * @param {number} swLat - Latitude do canto sudoeste (inferior esquerdo)
   * @param {number} swLng - Longitude do canto sudoeste
   * @param {number} neLat - Latitude do canto nordeste (superior direito)
   * @param {number} neLng - Longitude do canto nordeste
   * @returns {Promise<Array>} Pontos dentro da bounding box
   */
  async buscarPorBoundingBox(swLat, swLng, neLat, neLng) {
    /*
     * ST_MakeEnvelope recebe (lng_min, lat_min, lng_max, lat_max, SRID).
     * Atenção: a ordem dos parâmetros é (X, Y) = (longitude, latitude).
     */
    const resultado = await query(
      `SELECT * FROM pontos_mapa
       WHERE ativo = true
         AND ST_Within(
               localizacao::geometry,
               ST_MakeEnvelope($2, $1, $4, $3, 4326)
             )
       ORDER BY nome ASC`,
      [swLat, swLng, neLat, neLng]
    );

    return resultado.rows;
  },

  async listarPinsParaMapaBBox(swLat, swLng, neLat, neLng) {
    const resultado = await query(
      `SELECT id, nome, latitude, longitude, categoria,
              CASE categoria
                WHEN 'abrigo' THEN 'home'
                WHEN 'ong' THEN 'heart'
                WHEN 'clinica' THEN 'medkit'
                WHEN 'parque' THEN 'tree'
                ELSE 'pin'
              END AS icone,
              'ponto_mapa' AS tipo_original
       FROM pontos_mapa
       WHERE ativo = true
         AND ST_Within(
               localizacao::geometry,
               ST_MakeEnvelope($2, $1, $4, $3, 4326)
             )`,
      [swLat, swLng, neLat, neLng]
    );
    return resultado.rows;
  },

  /**
   * Atualiza os dados de um ponto de interesse.
   * Recalcula a coluna geography com as novas coordenadas.
   *
   * @param {string} id - UUID do ponto
   * @param {object} dados - Campos a serem atualizados
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizar(id, dados) {
    const { nome, descricao, categoria, endereco, latitude, longitude, telefone, whatsapp, servicos } = dados;

    const resultado = await query(
      `UPDATE pontos_mapa
       SET nome = $2,
           descricao = $3,
           categoria = $4,
           endereco = $5,
           latitude = $6,
           longitude = $7,
           localizacao = ST_SetSRID(ST_MakePoint($11, $12), 4326)::geography,
           telefone = $8,
           whatsapp = $9,
           servicos = $10
       WHERE id = $1
       RETURNING *`,
      [id, nome, descricao, categoria, endereco, latitude, longitude, telefone, whatsapp, servicos, parseFloat(longitude), parseFloat(latitude)]
    );

    return resultado.rows[0];
  },

  /**
   * Ativa ou desativa um ponto de interesse.
   * Pontos desativados não aparecem no mapa público.
   *
   * @param {string} id - UUID do ponto
   * @param {boolean} ativo - true para ativar, false para desativar
   * @returns {Promise<object>} O registro atualizado
   */
  async ativarDesativar(id, ativo) {
    const resultado = await query(
      `UPDATE pontos_mapa
       SET ativo = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, ativo]
    );

    return resultado.rows[0];
  },
  async deletar(id) {
    const resultado = await query(
      `DELETE FROM pontos_mapa WHERE id = $1 RETURNING *`,
      [id]
    );
    return resultado.rows[0];
  },
};

module.exports = PontoMapa;
