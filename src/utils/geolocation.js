/**
 * geolocation.js — Helpers para queries PostGIS
 *
 * Funcoes auxiliares para construir queries geograficas
 * de bounding box, proximidade e pontos.
 */

/**
 * Monta um ponto GEOGRAPHY a partir de lat/lng para INSERT.
 * PostGIS usa a ordem (longitude, latitude) — o inverso do habitual.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} SQL fragment: ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
 */
function montarPonto(lng, lat) {
  return `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/**
 * Monta clausula WHERE para bounding box (lazy loading do mapa).
 * Recebe os 4 cantos do viewport e retorna o filtro SQL.
 *
 * @param {string} coluna - Nome da coluna GEOGRAPHY (ex: 'localizacao')
 * @param {number} swLat - Latitude sudoeste
 * @param {number} swLng - Longitude sudoeste
 * @param {number} neLat - Latitude nordeste
 * @param {number} neLng - Longitude nordeste
 * @returns {string} SQL fragment para WHERE
 */
function filtroBoundingBox(coluna, swLat, swLng, neLat, neLng) {
  return `${coluna} && ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326)::geography`;
}

/**
 * Monta clausula WHERE para buscar registros dentro de um raio em metros.
 *
 * @param {string} colunaA - Coluna GEOGRAPHY do primeiro ponto
 * @param {string} colunaB - Coluna GEOGRAPHY do segundo ponto (ou valor direto)
 * @param {number} raioMetros - Raio em metros
 * @returns {string} SQL fragment para WHERE
 */
function filtroProximidade(colunaA, colunaB, raioMetros) {
  return `ST_DWithin(${colunaA}, ${colunaB}, ${raioMetros})`;
}

module.exports = { montarPonto, filtroBoundingBox, filtroProximidade };
