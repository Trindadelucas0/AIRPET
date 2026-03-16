/**
 * mapaController.js — Controller do Mapa Público do AIRPET
 *
 * Controller de API que serve dados geográficos para o mapa interativo.
 * O mapa utiliza Leaflet.js no frontend e carrega os dados via fetch.
 *
 * O principal endpoint retorna pins (marcadores) em formato GeoJSON,
 * filtrados por uma bounding box (retângulo geográfico que corresponde
 * à viewport visível do mapa no navegador do usuário).
 *
 * Tipos de pins retornados:
 *   - Pontos de interesse (abrigos, ONGs, clínicas, parques)
 *   - Petshops parceiros
 *   - Alertas de pets perdidos aprovados
 *
 * Formato GeoJSON (RFC 7946):
 *   {
 *     "type": "FeatureCollection",
 *     "features": [
 *       {
 *         "type": "Feature",
 *         "geometry": { "type": "Point", "coordinates": [lng, lat] },
 *         "properties": { "nome": "...", "tipo": "...", ... }
 *       }
 *     ]
 *   }
 *
 * Rotas:
 *   GET /api/mapa/pins?swLat=...&swLng=...&neLat=...&neLng=... → buscarPins
 */

const PontoMapa = require('../models/PontoMapa');
const Petshop = require('../models/Petshop');
const PetPerdido = require('../models/PetPerdido');
const TagScan = require('../models/TagScan');
const logger = require('../utils/logger');

/**
 * buscarPins — Retorna os marcadores do mapa dentro de uma bounding box
 *
 * Rota: GET /api/mapa/pins
 * Tipo: API (retorna GeoJSON)
 *
 * Query params necessários:
 *   - swLat: Latitude do canto sudoeste (inferior esquerdo)
 *   - swLng: Longitude do canto sudoeste
 *   - neLat: Latitude do canto nordeste (superior direito)
 *   - neLng: Longitude do canto nordeste
 *
 * Estes valores são enviados pelo Leaflet.js quando o usuário
 * movimenta ou dá zoom no mapa. Representam o retângulo visível.
 *
 * O controller busca 3 tipos de dados:
 *   1. Pontos de interesse (tabela pontos_mapa) — filtrados por bounding box
 *   2. Petshops parceiros — todos os ativos (sem filtro geográfico por ora)
 *   3. Pets perdidos aprovados — todos os com alerta ativo
 *
 * Todos os dados são convertidos para formato GeoJSON (FeatureCollection)
 * e retornados em uma única resposta para o frontend.
 *
 * @param {object} req - Requisição Express com query { swLat, swLng, neLat, neLng }
 * @param {object} res - Resposta Express (GeoJSON)
 */
async function buscarPins(req, res) {
  try {
    /* Extrai as coordenadas da bounding box dos query params */
    const { swLat, swLng, neLat, neLng } = req.query;

    /* Validação: todos os 4 parâmetros são obrigatórios */
    if (!swLat || !swLng || !neLat || !neLng) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Os parâmetros swLat, swLng, neLat e neLng são obrigatórios.',
      });
    }

    /* Converte strings para números de ponto flutuante */
    const sw = { lat: parseFloat(swLat), lng: parseFloat(swLng) };
    const ne = { lat: parseFloat(neLat), lng: parseFloat(neLng) };

    /* Valida se os valores são números válidos */
    if (isNaN(sw.lat) || isNaN(sw.lng) || isNaN(ne.lat) || isNaN(ne.lng)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'As coordenadas devem ser números válidos.',
      });
    }

    /*
     * Busca os 4 tipos de dados em paralelo para performance.
     * Pontos do mapa e últimos scans por pet são filtrados pela bounding box.
     */
    const [pontos, petshops, perdidos, petScans] = await Promise.all([
      PontoMapa.buscarPorBoundingBox(sw.lat, sw.lng, ne.lat, ne.lng),
      Petshop.listarAtivos(),
      PetPerdido.listarAprovados(),
      TagScan.listarUltimoScanPorPetNaBox(sw.lat, sw.lng, ne.lat, ne.lng),
    ]);

    /*
     * Monta o FeatureCollection GeoJSON combinando todos os dados.
     * Cada item é convertido em um Feature com geometry (Point) e properties.
     *
     * IMPORTANTE: GeoJSON usa [longitude, latitude] (não [lat, lng]!)
     * Leaflet.js faz a conversão automaticamente ao consumir GeoJSON.
     */
    const features = [];

    /* Converte pontos de interesse para features GeoJSON */
    pontos.forEach((ponto) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [ponto.longitude, ponto.latitude],
        },
        properties: {
          id: ponto.id,
          tipo: 'ponto_interesse',
          categoria: ponto.categoria,
          nome: ponto.nome,
          descricao: ponto.descricao,
          endereco: ponto.endereco,
        },
      });
    });

    /* Converte petshops para features GeoJSON */
    petshops.forEach((petshop) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [petshop.longitude, petshop.latitude],
        },
        properties: {
          id: petshop.id,
          tipo: 'petshop',
          nome: petshop.nome,
          endereco: petshop.endereco,
          telefone: petshop.telefone,
        },
      });
    });

    /* Converte alertas de pets perdidos para features GeoJSON */
    perdidos.forEach((perdido) => {
      /* Só inclui se tiver coordenadas válidas */
      if (perdido.latitude && perdido.longitude) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [perdido.longitude, perdido.latitude],
          },
          properties: {
            id: perdido.id,
            tipo: 'pet_perdido',
            nome: perdido.pet_nome,
            foto: perdido.pet_foto,
            dono: perdido.dono_nome,
            nivel_alerta: perdido.nivel_alerta,
            descricao: perdido.descricao,
          },
        });
      }
    });

    /* Última localização da tag por pet (scan NFC) dentro da bbox */
    (petScans || []).forEach((row) => {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          id: row.pet_id,
          tipo: 'pet_scan',
          nome: row.pet_nome || 'Pet',
          foto: row.pet_foto || null,
          cidade: row.cidade || null,
          data: row.data ? new Date(row.data).toISOString() : null,
        },
      });
    });

    /* Retorna o FeatureCollection GeoJSON completo */
    return res.status(200).json({
      type: 'FeatureCollection',
      features,
    });
  } catch (erro) {
    logger.error('MapaController', 'Erro ao buscar pins do mapa', erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao carregar os dados do mapa.',
    });
  }
}

/* Exporta o controller */
module.exports = {
  buscarPins,
};
