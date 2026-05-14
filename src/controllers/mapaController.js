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
const PetCheckin = require('../models/PetCheckin');
const petEventBus = require('../services/petEventBus');
const logger = require('../utils/logger');

const SSE_MAX_CONNECTIONS = 500;
const SSE_TTL_MS = 5 * 60 * 1000;   // 5 min — reconecta automaticamente
const SSE_HB_MS  = 25 * 1000;        // heartbeat 25s
let   _sseConnections = 0;

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
     * Todos os tipos são filtrados pela bounding box — evita retornar
     * centenas de registros de todo o Brasil a cada pan do mapa.
     */
    const [pontos, petshops, perdidos, petScans] = await Promise.all([
      PontoMapa.buscarPorBoundingBox(sw.lat, sw.lng, ne.lat, ne.lng),
      Petshop.listarPinsParaMapaBBox(sw.lat, sw.lng, ne.lat, ne.lng),
      PetPerdido.listarAprovadosNaBox(sw.lat, sw.lng, ne.lat, ne.lng),
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
          imagem_url: petshop.logo_url || petshop.foto_capa_url || null,
          perfil_url: `/petshops/${petshop.slug || petshop.id}`,
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
      // Regra de visibilidade: no mapa público, exibir scan apenas de pets perdidos.
      if (row.pet_status !== 'perdido') return;
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const scanData = row.data ? new Date(row.data) : null;
      const horasAtras = scanData ? (Date.now() - scanData.getTime()) / 3600000 : null;
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
          pet_status: row.pet_status || 'ativo',
          cidade: row.cidade || null,
          data: scanData ? scanData.toISOString() : null,
          horas_atras: horasAtras !== null ? Math.round(horasAtras) : null,
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

/**
 * buscarPinsSocial — Retorna última localização dos pets que o usuário segue
 *
 * Rota: GET /mapa/api/pins/social (requer autenticação)
 */
async function buscarPinsSocial(req, res) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
  }

  try {
    const usuarioId = req.session.usuario.id;
    const { query } = require('../config/database');

    const [resultado, checkinRows] = await Promise.all([
      query(
        `SELECT DISTINCT ON (t.pet_id)
         t.pet_id,
         p.nome AS pet_nome,
         p.foto AS pet_foto,
         p.slug AS pet_slug,
         p.status AS pet_status,
         ts.latitude,
         ts.longitude,
         ts.cidade,
         ts.data
       FROM tag_scans ts
       JOIN nfc_tags t ON t.id = ts.tag_id
       JOIN pets p ON p.id = t.pet_id
       JOIN seguidores_pets sp ON sp.pet_id = t.pet_id
       WHERE sp.usuario_id = $1
         AND t.status = 'active'
         AND ts.latitude IS NOT NULL
         AND ts.longitude IS NOT NULL
         AND ts.data > NOW() - INTERVAL '30 days'
       ORDER BY t.pet_id, ts.data DESC
       LIMIT 100`,
        [usuarioId]
      ),
      PetCheckin.listarPinsPublicosSeguidos(usuarioId, 100),
    ]);

    const byPet = new Map();

    for (const row of resultado.rows) {
      const scanData = row.data ? new Date(row.data) : null;
      const ts = scanData ? scanData.getTime() : 0;
      byPet.set(row.pet_id, { source: 'scan', row, ts });
    }

    for (const c of checkinRows) {
      const ts = new Date(c.criado_em).getTime();
      const prev = byPet.get(c.pet_id);
      if (!prev || ts >= prev.ts) {
        byPet.set(c.pet_id, { source: 'checkin', row: c, ts });
      }
    }

    const features = [...byPet.values()].map((entry) => {
      if (entry.source === 'scan') {
        const row = entry.row;
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        const scanData = row.data ? new Date(row.data) : null;
        const horasAtras = scanData ? Math.round((Date.now() - scanData.getTime()) / 3600000) : null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            id: row.pet_id,
            tipo: 'pet_seguido',
            nome: row.pet_nome || 'Pet',
            foto: row.pet_foto || null,
            pet_status: row.pet_status || 'ativo',
            cidade: row.cidade || null,
            data: scanData ? scanData.toISOString() : null,
            horas_atras: horasAtras,
            slug: row.pet_slug || null,
          },
        };
      }
      const c = entry.row;
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      const when = new Date(c.criado_em);
      const horasAtras = Math.round((Date.now() - when.getTime()) / 3600000);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: c.pet_id,
          tipo: 'pet_checkin',
          nome: c.pet_nome || 'Pet',
          foto: c.pet_foto || null,
          pet_status: 'ativo',
          cidade: c.local_nome || null,
          data: when.toISOString(),
          horas_atras: horasAtras,
          slug: c.pet_slug || null,
        },
      };
    });

    return res.status(200).json({ type: 'FeatureCollection', features });
  } catch (erro) {
    logger.error('MapaController', 'Erro ao buscar pins sociais', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar pets seguidos.' });
  }
}

/**
 * streamMapaSSE — Server-Sent Events para atualizações em tempo real no mapa
 *
 * Rota: GET /mapa/api/stream
 * Query params: swLat, swLng, neLat, neLng (bounding box atual do mapa do cliente)
 *
 * Escuta o petEventBus e retransmite eventos nfc_scan cujas coordenadas
 * estejam dentro da bbox informada pelo cliente.
 */
async function streamMapaSSE(req, res) {
  if (_sseConnections >= SSE_MAX_CONNECTIONS) {
    return res.status(503).json({ mensagem: 'Muitas conexões ativas.' });
  }

  const swLat = parseFloat(req.query.swLat);
  const swLng = parseFloat(req.query.swLng);
  const neLat = parseFloat(req.query.neLat);
  const neLng = parseFloat(req.query.neLng);
  const hasBbox = !isNaN(swLat) && !isNaN(swLng) && !isNaN(neLat) && !isNaN(neLng);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  _sseConnections++;
  let closed = false;

  const hb = setInterval(() => {
    if (!closed) { try { res.write(':heartbeat\n\n'); } catch (_) { cleanup(); } }
  }, SSE_HB_MS);

  const ttl = setTimeout(() => {
    if (!closed) { try { res.write('event: close\ndata: {}\n\n'); res.end(); } catch (_) {} cleanup(); }
  }, SSE_TTL_MS);

  function cleanup() {
    if (closed) return;
    closed = true;
    _sseConnections--;
    clearInterval(hb);
    clearTimeout(ttl);
    petEventBus.removeListener('nfc_scan_global', onNfcScan);
  }

  function onNfcScan(data) {
    if (closed) return;
    // Regra de visibilidade: no mapa público via SSE, só transmite pets perdidos.
    if (data.petStatus !== 'perdido') return;
    // Filtrar pela bbox se fornecida
    if (hasBbox) {
      const lat = data.lat;
      const lng = data.lng;
      if (lat < swLat || lat > neLat || lng < swLng || lng > neLng) return;
    }
    try {
      res.write('event: nfc_scan\ndata: ' + JSON.stringify(data) + '\n\n');
    } catch (_) { cleanup(); }
  }

  // Registra listener no EventEmitter nativo (não no sistema SSE por pet)
  petEventBus.on('nfc_scan_global', onNfcScan);

  res.on('close', cleanup);
  res.on('error', cleanup);
}

/* Exporta o controller */
module.exports = {
  buscarPins,
  buscarPinsSocial,
  streamMapaSSE,
};
