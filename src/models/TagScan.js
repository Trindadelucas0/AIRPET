/**
 * TagScan.js — Modelo de dados para a tabela "tag_scans"
 *
 * Registra cada escaneamento de uma tag NFC.
 * Armazena localizacao GPS, cidade, IP e user agent.
 *
 * Tabela: tag_scans
 * Campos: id, tag_id, tag_code, latitude, longitude, cidade, ip, user_agent, data
 */

const { query } = require('../config/database');

const TagScan = {

  async registrar(dados) {
    const { tag_id, tag_code, latitude, longitude, cidade, ip, user_agent } = dados;

    const resultado = await query(
      `INSERT INTO tag_scans (tag_id, tag_code, latitude, longitude, cidade, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tag_id, tag_code, latitude, longitude, cidade, ip, user_agent]
    );

    return resultado.rows[0];
  },

  async buscarPorTag(tagId) {
    const resultado = await query(
      `SELECT * FROM tag_scans
       WHERE tag_id = $1
       ORDER BY data DESC`,
      [tagId]
    );

    return resultado.rows;
  },

  /**
   * Busca os ultimos N scans de um pet (via JOIN com nfc_tags).
   * Retorna scans com coordenadas validas para exibir no mapa.
   */
  async buscarPorPet(petId, limite = 10) {
    const resultado = await query(
      `SELECT ts.*, t.tag_code
       FROM tag_scans ts
       JOIN nfc_tags t ON t.id = ts.tag_id
       WHERE t.pet_id = $1
         AND ts.latitude IS NOT NULL
         AND ts.longitude IS NOT NULL
       ORDER BY ts.data DESC
       LIMIT $2`,
      [petId, limite]
    );

    return resultado.rows;
  },

  /**
   * Busca o scan mais recente de um pet (com coordenadas).
   */
  async ultimoScanPet(petId) {
    const resultado = await query(
      `SELECT ts.*, t.tag_code
       FROM tag_scans ts
       JOIN nfc_tags t ON t.id = ts.tag_id
       WHERE t.pet_id = $1
         AND ts.latitude IS NOT NULL
         AND ts.longitude IS NOT NULL
       ORDER BY ts.data DESC
       LIMIT 1`,
      [petId]
    );

    return resultado.rows[0] || null;
  },

  async listarRecentes(limite = 50) {
    const resultado = await query(
      `SELECT * FROM tag_scans
       ORDER BY data DESC
       LIMIT $1`,
      [limite]
    );

    return resultado.rows;
  },

  /**
   * Lista o último scan com coordenadas por pet dentro de uma bounding box (para pins no mapa).
   * Apenas tags ativas vinculadas a um pet; um pin por pet (o scan mais recente na caixa).
   * @param {number} swLat - Latitude canto sul-oeste
   * @param {number} swLng - Longitude canto sul-oeste
   * @param {number} neLat - Latitude canto nordeste
   * @param {number} neLng - Longitude canto nordeste
   * @returns {Promise<Array<{pet_id, pet_nome, pet_foto, latitude, longitude, cidade, data}>>}
   */
  async listarUltimoScanPorPetNaBox(swLat, swLng, neLat, neLng) {
    const resultado = await query(
      `SELECT DISTINCT ON (t.pet_id)
         t.pet_id,
         p.nome AS pet_nome,
         p.foto AS pet_foto,
         p.slug AS pet_slug,
         p.status AS pet_status,
         COALESCE(p.privado, false) AS privado,
         EXISTS (
           SELECT 1 FROM pets_perdidos pp
           WHERE pp.pet_id = p.id AND pp.status = 'aprovado'
         ) AS tem_alerta_perdido_aprovado,
         ts.latitude,
         ts.longitude,
         ts.cidade,
         ts.data
       FROM tag_scans ts
       JOIN nfc_tags t ON t.id = ts.tag_id
       JOIN pets p ON p.id = t.pet_id
       WHERE t.status = 'active'
         AND t.pet_id IS NOT NULL
         AND ts.latitude IS NOT NULL
         AND ts.longitude IS NOT NULL
         AND ts.latitude BETWEEN $1 AND $3
         AND ts.longitude BETWEEN $2 AND $4
         AND ts.data > NOW() - INTERVAL '30 days'
       ORDER BY t.pet_id, ts.data DESC
       LIMIT 200`,
      [swLat, swLng, neLat, neLng]
    );
    return resultado.rows;
  },

  /**
   * Agrega scans recentes em células grosseiras (~km) para heatmap público (sem identificar pets).
   */
  async listarHeatmapCelulasNaBox(swLat, swLng, neLat, neLng) {
    const resultado = await query(
      `SELECT
         ROUND(ts.latitude::numeric, 2) AS lat,
         ROUND(ts.longitude::numeric, 2) AS lng,
         COUNT(*)::int AS weight
       FROM tag_scans ts
       JOIN nfc_tags t ON t.id = ts.tag_id
       JOIN pets p ON p.id = t.pet_id
       WHERE t.status = 'active'
         AND t.pet_id IS NOT NULL
         AND ts.latitude IS NOT NULL
         AND ts.longitude IS NOT NULL
         AND ts.latitude BETWEEN $1 AND $3
         AND ts.longitude BETWEEN $2 AND $4
         AND ts.data > NOW() - INTERVAL '30 days'
         AND (
           p.status = 'perdido'
           OR EXISTS (
             SELECT 1 FROM pets_perdidos pp
             WHERE pp.pet_id = p.id AND pp.status = 'aprovado'
           )
           OR COALESCE(p.privado, false) = false
         )
       GROUP BY 1, 2
       ORDER BY weight DESC
       LIMIT 400`,
      [swLat, swLng, neLat, neLng]
    );
    return resultado.rows;
  },
};

module.exports = TagScan;
