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

const { query, pool } = require('../config/database');

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

  async listarAtivosComBuscaServico(termo) {
    const q = `%${String(termo || '').trim()}%`;
    const resultado = await query(
      `SELECT
         p.*,
         ARRAY_REMOVE(ARRAY_AGG(DISTINCT s.nome), NULL) AS servicos_encontrados
       FROM petshops p
       LEFT JOIN petshop_services s
         ON s.petshop_id = p.id
        AND s.ativo = true
       WHERE p.ativo = true
         AND (
           p.nome ILIKE $1
           OR s.nome ILIKE $1
           OR COALESCE(s.descricao, '') ILIKE $1
         )
       GROUP BY p.id
       ORDER BY p.nome ASC`,
      [q]
    );
    return resultado.rows;
  },

  /**
   * Campos mínimos para JSON público (ex.: GET /api/petshops/mapa).
   * Não expõe email, email_contato nem outras colunas internas.
   */
  async listarAtivosParaMapaPublico() {
    const resultado = await query(
      `SELECT id, nome, slug, endereco, latitude, longitude,
              telefone, whatsapp, descricao, logo_url, ponto_de_apoio
       FROM petshops
       WHERE ativo = true
       ORDER BY nome ASC`
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

  async atualizarCamposPublicos(id, dados) {
    const {
      nome = null,
      endereco = null,
      telefone = null,
      descricao = null,
      latitude = null,
      longitude = null,
    } = dados || {};
    const resultado = await query(
      `UPDATE petshops
       SET nome = COALESCE($2, nome),
           endereco = COALESCE($3, endereco),
           telefone = COALESCE($4, telefone),
           whatsapp = COALESCE($4, whatsapp),
           descricao = COALESCE($5, descricao),
           latitude = COALESCE($6, latitude),
           longitude = COALESCE($7, longitude),
           localizacao = CASE
             WHEN COALESCE($6, latitude) IS NOT NULL AND COALESCE($7, longitude) IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint(COALESCE($7, longitude), COALESCE($6, latitude)), 4326)::geography
             ELSE localizacao
           END,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nome, endereco, telefone, descricao, latitude, longitude]
    );
    return resultado.rows[0] || null;
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

  async listarPinsParaMapaBBox(swLat, swLng, neLat, neLng) {
    const resultado = await query(
      `SELECT id, nome, latitude, longitude, 'petshop' AS categoria,
              'store' AS icone, 'petshop' AS tipo_original
       FROM petshops
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

  async listarParaExplorar({ usuarioId, lat, lng, limite = 12, ordenarPor = 'proximidade' }) {
    const limitSeguro = Number.isInteger(limite) && limite > 0 ? limite : 12;
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

    const params = [usuarioId, limitSeguro];
    let distanciaCol = `NULL::numeric AS distancia_metros`;
    let orderBy = `p.avaliacao_media DESC, p.avaliacoes_count DESC, p.nome ASC`;

    if (hasGeo) {
      params.push(lat, lng);
      distanciaCol = `ST_Distance(
          p.localizacao,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
        ) AS distancia_metros`;
      if (ordenarPor === 'avaliacao') {
        orderBy = `p.avaliacao_media DESC, p.avaliacoes_count DESC, distancia_metros ASC NULLS LAST`;
      } else if (ordenarPor === 'relevancia') {
        orderBy = `relevance_score DESC, p.avaliacao_media DESC, distancia_metros ASC NULLS LAST`;
      } else {
        orderBy = `distancia_metros ASC, p.avaliacao_media DESC, p.avaliacoes_count DESC`;
      }
    } else {
      if (ordenarPor === 'relevancia') {
        orderBy = `relevance_score DESC, p.avaliacao_media DESC, p.avaliacoes_count DESC`;
      } else if (ordenarPor === 'proximidade') {
        orderBy = `p.avaliacao_media DESC, p.avaliacoes_count DESC, p.nome ASC`;
      }
    }

    const resultado = await query(
      `SELECT
         p.*,
         ${distanciaCol},
         EXISTS (
           SELECT 1 FROM petshop_followers pf
           WHERE pf.petshop_id = p.id AND pf.usuario_id = $1
         ) AS usuario_segue,
         EXISTS (
           SELECT 1
           FROM pet_petshop_links ppl
           JOIN pets my_pet ON my_pet.id = ppl.pet_id
           WHERE ppl.petshop_id = p.id
             AND ppl.ativo = true
             AND my_pet.usuario_id = $1
         ) AS usuario_vinculado,
         COALESCE((
           SELECT MAX(COALESCE(ppl.relevance_score, 0))
           FROM pet_petshop_links ppl
           JOIN pets my_pet ON my_pet.id = ppl.pet_id
           WHERE ppl.petshop_id = p.id
             AND ppl.ativo = true
             AND my_pet.usuario_id = $1
         ), 0) AS relevance_score,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM pet_petshop_links ppl
             JOIN pets my_pet ON my_pet.id = ppl.pet_id
             WHERE ppl.petshop_id = p.id
               AND ppl.ativo = true
               AND my_pet.usuario_id = $1
           ) THEN 'vinculado'
           WHEN EXISTS (
             SELECT 1 FROM petshop_followers pf
             WHERE pf.petshop_id = p.id AND pf.usuario_id = $1
           ) THEN 'seguindo'
           ELSE 'descoberta'
         END AS relationship_level
       FROM petshops p
       WHERE p.ativo = true
       ORDER BY ${orderBy}
       LIMIT $2`,
      params
    );
    return resultado.rows;
  },

  async existeSlug(slug) {
    const r = await query('SELECT 1 FROM petshops WHERE slug = $1 LIMIT 1', [slug]);
    return r.rows.length > 0;
  },

  async criarRascunhoCadastroPublico({
    nome,
    endereco,
    telefone,
    emailContato,
    latitude,
    longitude,
    slug,
    descricao,
    logoUrl,
    fotoCapaUrl,
  }, client = null) {
    const executor = client || pool;
    const resultado = await executor.query(
      `INSERT INTO petshops (
        nome, endereco, telefone, whatsapp, email_contato,
        latitude, longitude, localizacao, ativo, status_parceria, slug, descricao, logo_url, foto_capa_url, data_atualizacao
      )
      VALUES (
        $1, $2, $3, $3, $4,
        $5::numeric, $6::numeric,
        CASE
          WHEN $5::numeric IS NOT NULL AND $6::numeric IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($6::double precision, $5::double precision), 4326)::geography
          ELSE NULL
        END,
        false, 'pendente', $7, $8, $9, $10, NOW()
      )
      RETURNING *`,
      [nome, endereco, telefone, emailContato, latitude, longitude, slug, descricao || null, logoUrl, fotoCapaUrl]
    );
    return resultado.rows[0];
  },

  async atualizarDeSolicitacaoAprovada(petshopId, dados, client = null) {
    const {
      nome,
      endereco,
      telefone,
      email,
      latitude,
      longitude,
      descricao,
      logoUrl,
      fotoCapaUrl,
      slug,
    } = dados;
    const executor = client || pool;
    const resultado = await executor.query(
      `UPDATE petshops
       SET nome = $2,
           endereco = $3,
           telefone = $4,
           whatsapp = $5,
           email_contato = $6,
           latitude = $7::numeric,
           longitude = $8::numeric,
           localizacao = CASE
             WHEN $7::numeric IS NOT NULL AND $8::numeric IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326)::geography
             ELSE localizacao
           END,
           descricao = COALESCE($9, descricao),
           logo_url = COALESCE($10, logo_url),
           foto_capa_url = COALESCE($11, foto_capa_url),
           ativo = true,
           ponto_de_apoio = true,
           status_parceria = 'ativo',
           slug = COALESCE(slug, $12),
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        petshopId,
        nome,
        endereco,
        telefone,
        telefone,
        email,
        latitude,
        longitude,
        descricao || null,
        logoUrl || null,
        fotoCapaUrl || null,
        slug,
      ]
    );
    return resultado.rows[0];
  },

  async criarAtivoPorSolicitacaoAprovada(dados, client = null) {
    const {
      nome,
      endereco,
      telefone,
      email,
      latitude,
      longitude,
      descricao,
      logoUrl,
      fotoCapaUrl,
      slug,
    } = dados;
    const executor = client || pool;
    const resultado = await executor.query(
      `INSERT INTO petshops (
        nome, endereco, telefone, whatsapp, email_contato,
        latitude, longitude, localizacao, ativo, ponto_de_apoio,
        descricao, logo_url, foto_capa_url, status_parceria, slug, data_atualizacao
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6::numeric, $7::numeric,
        CASE
          WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326)::geography
          ELSE NULL
        END,
        true, true,
        $8, $9, $10, 'ativo', $11, NOW()
      )
      RETURNING *`,
      [
        nome,
        endereco,
        telefone,
        telefone,
        email,
        latitude,
        longitude,
        descricao || null,
        logoUrl || null,
        fotoCapaUrl || null,
        slug,
      ]
    );
    return resultado.rows[0];
  },

  async marcarParceriaRejeitada(petshopId, client = null) {
    const executor = client || pool;
    await executor.query(
      `UPDATE petshops
       SET status_parceria = 'rejeitado', ativo = false, data_atualizacao = NOW()
       WHERE id = $1`,
      [petshopId]
    );
  },

  async marcarParceriaEmAnalise(petshopId, client = null) {
    const executor = client || pool;
    await executor.query(
      `UPDATE petshops
       SET status_parceria = 'em_analise', data_atualizacao = NOW()
       WHERE id = $1`,
      [petshopId]
    );
  },
};

module.exports = Petshop;
