/**
 * mapaService.js — Serviço do mapa interativo do sistema AIRPET
 *
 * Este módulo centraliza a lógica de busca de pontos para exibição
 * no mapa interativo (Leaflet/Mapbox) do aplicativo.
 *
 * O mapa exibe 4 categorias de pontos (pins):
 *   1. Petshops parceiros — lojas e clínicas veterinárias
 *   2. Pontos de interesse — abrigos, ONGs, parques pet-friendly
 *   3. Pets perdidos — alertas aprovados ativos no mapa
 *   4. Localizações recentes — últimas posições dos pets com NFC ativo
 *
 * O resultado é formatado como GeoJSON FeatureCollection (RFC 7946),
 * que é o formato padrão suportado por Leaflet, Mapbox e Google Maps.
 *
 * Estratégia de carregamento (lazy loading):
 *   - O frontend envia as coordenadas da viewport (bounding box)
 *   - O backend retorna apenas os pontos visíveis naquela área
 *   - Limite de 200 features por requisição para performance
 */

const Petshop = require('../models/Petshop');
const PontoMapa = require('../models/PontoMapa');
const PetPerdido = require('../models/PetPerdido');
const Localizacao = require('../models/Localizacao');
const logger = require('../utils/logger');

const mapaService = {

  /**
   * Busca todos os pins (marcadores) dentro de uma bounding box para o mapa.
   *
   * Este método executa múltiplas queries em paralelo para buscar diferentes
   * tipos de pontos e combina todos em um único GeoJSON FeatureCollection.
   *
   * A bounding box é definida pelos cantos sudoeste (SW) e nordeste (NE)
   * do viewport do mapa no frontend:
   *
   *   NE ─────────────────────── ┐
   *   │                          │
   *   │    (área visível do      │
   *   │     mapa no navegador)   │
   *   │                          │
   *   └ ─────────────────────── SW
   *
   * @param {number} swLat - Latitude do canto sudoeste (inferior esquerdo)
   * @param {number} swLng - Longitude do canto sudoeste
   * @param {number} neLat - Latitude do canto nordeste (superior direito)
   * @param {number} neLng - Longitude do canto nordeste
   * @param {Array<string>} [categorias] - Filtro opcional de categorias a incluir.
   *   Valores possíveis: ['petshops', 'pontos', 'perdidos', 'localizacoes']
   *   Se não fornecido ou vazio, retorna todas as categorias.
   * @returns {Promise<object>} GeoJSON FeatureCollection com até 200 features
   *
   * @example
   * const geojson = await mapaService.buscarPins(
   *   -23.60, -46.70, -23.50, -46.60, ['petshops', 'perdidos']
   * );
   * // geojson = {
   * //   type: 'FeatureCollection',
   * //   features: [
   * //     { type: 'Feature', geometry: { type: 'Point', coordinates: [-46.63, -23.55] },
   * //       properties: { id, nome, categoria: 'petshop', icone: 'store', tipo_original: 'petshop' } },
   * //     ...
   * //   ]
   * // }
   */
  async buscarPins(swLat, swLng, neLat, neLng, categorias) {
    logger.info('MapaService', `Buscando pins — bbox: [${swLat},${swLng}] → [${neLat},${neLng}]`);

    /**
     * Determina quais categorias buscar.
     * Se o parâmetro categorias não for fornecido ou for vazio,
     * busca todas as 4 categorias disponíveis.
     */
    const categoriasAtivas = (categorias && categorias.length > 0)
      ? categorias
      : ['petshops', 'pontos', 'perdidos', 'localizacoes'];

    /**
     * Array para acumular todos os resultados.
     * Cada resultado é um array de features GeoJSON.
     */
    const todasFeatures = [];

    /**
     * Executa as queries em PARALELO para melhor performance.
     * Cada query busca um tipo diferente de ponto dentro da bounding box.
     * Todas usam ST_Within/ST_MakeEnvelope para filtragem geográfica.
     */
    const promessas = [];

    /**
     * QUERY 1 — PETSHOPS PARCEIROS
     * Busca petshops ativos dentro da bounding box.
     * Ícone: 'store' (lojinha no mapa)
     */
    if (categoriasAtivas.includes('petshops')) {
      promessas.push(Petshop.listarPinsParaMapaBBox(swLat, swLng, neLat, neLng));
    }

    /**
     * QUERY 2 — PONTOS DE INTERESSE (abrigos, ONGs, parques, clínicas)
     * Busca pontos ativos dentro da bounding box.
     * Ícone: varia conforme a categoria do ponto
     */
    if (categoriasAtivas.includes('pontos')) {
      promessas.push(PontoMapa.listarPinsParaMapaBBox(swLat, swLng, neLat, neLng));
    }

    /**
     * QUERY 3 — PETS PERDIDOS (alertas aprovados)
     * Busca alertas de pets perdidos com status 'aprovado' na área.
     * Ícone: 'alert' (ponto de exclamação vermelho no mapa)
     */
    if (categoriasAtivas.includes('perdidos')) {
      promessas.push(PetPerdido.listarPinsParaMapaBBox(swLat, swLng, neLat, neLng));
    }

    /**
     * QUERY 4 — LOCALIZAÇÕES RECENTES DE PETS
     * Busca as últimas localizações registradas de pets com tag ativa.
     * Ícone: 'paw' (patinha de animal no mapa)
     * Apenas a localização mais recente de cada pet (DISTINCT ON).
     */
    if (categoriasAtivas.includes('localizacoes')) {
      promessas.push(Localizacao.listarUltimasPorPetParaMapaBBox(swLat, swLng, neLat, neLng));
    }

    /**
     * Aguarda todas as queries em paralelo.
     * Promise.all retorna os resultados na mesma ordem das promessas.
     */
    const resultados = await Promise.all(promessas);

    /**
     * Combina todos os resultados em um único array de features.
     * Cada resultado é um array de rows — flat() achata tudo.
     */
    for (const rows of resultados) {
      todasFeatures.push(...rows);
    }

    logger.info('MapaService', `Total de pontos encontrados: ${todasFeatures.length}`);

    /**
     * Limita a 200 features por requisição para evitar sobrecarga.
     * Em cenários com muitos pontos, o frontend deve ajustar o zoom
     * para reduzir a área da bounding box.
     */
    const featuresLimitadas = todasFeatures.slice(0, 200);

    /**
     * Converte os registros do banco para o formato GeoJSON (RFC 7946).
     *
     * Estrutura de cada Feature:
     * {
     *   type: 'Feature',
     *   geometry: {
     *     type: 'Point',
     *     coordinates: [longitude, latitude]  // GeoJSON usa [lng, lat]!
     *   },
     *   properties: {
     *     id: 'uuid',
     *     nome: 'Nome do ponto',
     *     categoria: 'petshop|abrigo|pet_perdido|localizacao',
     *     icone: 'store|home|alert|paw',
     *     tipo_original: 'petshop|ponto_mapa|pet_perdido|localizacao'
     *   }
     * }
     */
    const features = featuresLimitadas.map(ponto => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          parseFloat(ponto.longitude),
          parseFloat(ponto.latitude),
        ],
      },
      properties: {
        id: ponto.id,
        nome: ponto.nome || ponto.pet_nome,
        categoria: ponto.categoria,
        icone: ponto.icone,
        tipo_original: ponto.tipo_original,
        foto_url: ponto.foto_url || null,
        pet_foto: ponto.pet_foto || null,
      },
    }));

    /**
     * Monta o FeatureCollection final.
     * Este é o objeto raiz do GeoJSON, contendo todas as features.
     */
    const featureCollection = {
      type: 'FeatureCollection',
      features,
    };

    logger.info('MapaService', `GeoJSON montado com ${features.length} feature(s)`);

    return featureCollection;
  },
};

module.exports = mapaService;
