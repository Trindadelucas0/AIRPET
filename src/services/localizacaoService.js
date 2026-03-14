/**
 * localizacaoService.js — Serviço de geolocalização do sistema AIRPET
 *
 * Este módulo gerencia o registro e consulta de localizações dos pets.
 * Cada localização é um ponto geográfico captado de diferentes fontes:
 *   - NFC/QR: quando alguém escaneia a tag do pet
 *   - GPS: quando o app do tutor envia coordenadas
 *   - Manual: quando o tutor informa a posição manualmente
 *
 * As localizações são armazenadas com PostGIS (geography) para
 * permitir consultas espaciais eficientes como:
 *   - "Onde meu pet foi visto pela última vez?"
 *   - "Qual a rota de movimentação do pet?"
 *   - "Quais pets estão próximos a este ponto?"
 */

const Localizacao = require('../models/Localizacao');
const logger = require('../utils/logger');

const localizacaoService = {

  /**
   * Registra uma nova localização para um pet.
   *
   * Este método é chamado em diversos pontos do sistema:
   *   1. Quando alguém escaneia a tag NFC do pet (nfcService.processarScan)
   *   2. Quando o app do tutor envia atualização de GPS
   *   3. Quando o tutor marca a posição manualmente no mapa
   *
   * Além de salvar no banco, este método pode futuramente
   * acionar alertas se o pet estiver perdido e for avistado
   * em uma nova localização.
   *
   * @param {string} petId - UUID do pet cuja localização está sendo registrada
   * @param {number} lat - Latitude do ponto (ex: -23.5505 para São Paulo)
   * @param {number} lng - Longitude do ponto (ex: -46.6333 para São Paulo)
   * @param {string} [cidade] - Nome da cidade onde o pet foi visto (geocoding reverso)
   * @param {string} [ip] - Endereço IP de quem registrou a localização
   * @param {string} [fotoUrl] - URL da foto tirada no momento do avistamento (opcional)
   * @returns {Promise<object>} O registro de localização criado com ponto PostGIS
   * @throws {Error} Se os dados de localização forem inválidos
   *
   * @example
   * const loc = await localizacaoService.registrar(
   *   'pet-uuid', -23.5505, -46.6333, 'São Paulo', '189.100.50.25', null
   * );
   * // loc.latitude = -23.5505
   * // loc.longitude = -46.6333
   * // loc.ponto = <PostGIS geography>
   */
  async registrar(petId, lat, lng, cidade, ip, fotoUrl) {
    logger.info('LocalizacaoService', `Registrando localização para pet: ${petId} — lat: ${lat}, lng: ${lng}`);

    /**
     * Monta o objeto de dados para o model Localizacao.
     * A origem é marcada como 'nfc' por padrão — em cenários futuros,
     * outros fluxos podem passar 'gps' ou 'manual'.
     *
     * O campo fotoUrl é armazenado para referência futura
     * (ex: foto do pet no local onde foi avistado).
     */
    const dadosLocalizacao = {
      pet_id: petId,
      latitude: lat,
      longitude: lng,
      origem: 'nfc',
    };

    const localizacao = await Localizacao.registrar(dadosLocalizacao);

    logger.info('LocalizacaoService', `Localização registrada: ${localizacao.id} para pet: ${petId}`);

    return localizacao;
  },

  /**
   * Busca o histórico completo de localizações de um pet.
   *
   * Retorna todas as localizações registradas, ordenadas da mais
   * recente para a mais antiga. Isso permite:
   *   - Traçar a rota/movimentação do pet no mapa
   *   - Ver onde o pet foi avistado pela última vez
   *   - Analisar padrões de movimentação
   *
   * @param {string} petId - UUID do pet
   * @returns {Promise<Array>} Array de registros de localização ordenados por data (DESC)
   *
   * @example
   * const historico = await localizacaoService.buscarHistorico('pet-uuid');
   * // historico = [
   * //   { id, pet_id, latitude: -23.55, longitude: -46.63, data_registro: '2026-03-13...' },
   * //   { id, pet_id, latitude: -23.56, longitude: -46.64, data_registro: '2026-03-12...' },
   * //   ...
   * // ]
   */
  async buscarHistorico(petId) {
    logger.info('LocalizacaoService', `Buscando histórico de localizações para pet: ${petId}`);

    const historico = await Localizacao.buscarPorPet(petId);

    logger.info('LocalizacaoService', `Encontradas ${historico.length} localização(ões) para pet: ${petId}`);

    return historico;
  },
};

module.exports = localizacaoService;
