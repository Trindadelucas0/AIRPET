/**
 * proximidadeService.js — Serviço de busca por proximidade do sistema AIRPET
 *
 * Este módulo implementa o sistema de alerta escalonável por proximidade.
 * Quando um pet é reportado como perdido, o sistema notifica usuários
 * em raios progressivamente maiores ao longo do tempo.
 *
 * Sistema de escalação de alertas:
 *
 *   NÍVEL 1 (Inicial)  → Raio de 2km  → Vizinhança imediata
 *   NÍVEL 2 (Escalado) → Raio de 5km  → Bairros ao redor
 *   NÍVEL 3 (Máximo)   → Raio de 15km → Cidade inteira
 *
 * Cada nível é ativado manualmente pelo admin ou automaticamente
 * pelo agendador (cron job) conforme o tempo passa sem resolução.
 *
 * O serviço usa PostGIS (extensão geográfica do PostgreSQL)
 * para calcular distâncias reais na superfície da Terra.
 */

const Usuario = require('../models/Usuario');
const petLostAlertService = require('../domain/alerts/petLostAlertService');
const logger = require('../utils/logger');

/**
 * Configurações padrão de raio por nível de alerta (em km).
 * Estes valores são usados como fallback quando as configurações
 * não estão definidas na tabela config_sistema.
 *
 * A tabela config_sistema pode sobrescrever estes valores com as chaves:
 *   - 'raio_alerta_nivel1_km': raio em km para nível 1 (padrão: 2)
 *   - 'raio_alerta_nivel2_km': raio em km para nível 2 (padrão: 5)
 *   - 'raio_alerta_nivel3_km': raio em km para nível 3 (padrão: 15)
 */
const proximidadeService = {

  /**
   * Busca todos os usuários dentro de um raio geográfico.
   *
   * Executa uma query PostGIS usando ST_DWithin para encontrar
   * usuários cuja última localização conhecida está dentro do
   * raio especificado a partir de um ponto central.
   *
   * Requisitos para um usuário aparecer nos resultados:
   *   - Campo ultima_localizacao (geography) não pode ser NULL
   *   - Deve estar dentro do raio especificado
   *
   * @param {number} lat - Latitude do ponto central (ex: -23.5505)
   * @param {number} lng - Longitude do ponto central (ex: -46.6333)
   * @param {number} raioKm - Raio de busca em quilômetros
   * @returns {Promise<Array<string>>} Array de UUIDs dos usuários encontrados
   *
   * @example
   * const ids = await proximidadeService.buscarUsuariosProximos(-23.55, -46.63, 5);
   * // ids = ['uuid-1', 'uuid-2', 'uuid-3']
   */
  async buscarUsuariosProximos(lat, lng, raioKm) {
    logger.info('ProximidadeService', `Buscando usuários — centro: [${lat}, ${lng}], raio: ${raioKm}km`);

    /**
     * Converte quilômetros para metros.
     * PostGIS com geography (SRID 4326) calcula distâncias em metros.
     */
    const raioMetros = raioKm * 1000;

    /**
     * QUERY POSTGIS — Busca usuários próximos ao ponto.
     *
     * ST_DWithin(geographyA, geographyB, distancia_metros):
     *   Retorna true se a distância geodésica entre os dois pontos
     *   for menor ou igual à distância especificada em metros.
     *   Usa o modelo esférico da Terra para cálculos precisos.
     *
     * ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography:
     *   Cria um ponto geográfico a partir das coordenadas.
     *   ATENÇÃO: ST_MakePoint recebe (X, Y) = (longitude, latitude).
     *
     * Filtro ultima_localizacao IS NOT NULL:
     *   Ignora usuários que nunca compartilharam sua localização.
     */
    const usuarioIds = await Usuario.listarIdsDentroRaioMetros(lat, lng, raioMetros);

    logger.info('ProximidadeService', `Encontrados ${usuarioIds.length} usuário(s) no raio de ${raioKm}km`);

    return usuarioIds;
  },

  /**
   * Escala o nível de alerta de um pet perdido para o próximo nível.
   *
   * O sistema de escalação funciona em 3 níveis progressivos:
   *
   *   Nível Atual → Próximo Nível → Novo Raio
   *   ──────────────────────────────────────────
   *   1           → 2              → 5km
   *   2           → 3              → 15km
   *   3           → (máximo)       → sem escalação
   *
   * Processo detalhado:
   *   1. Busca o alerta de pet perdido no banco
   *   2. Verifica o nível atual e calcula o próximo
   *   3. Se já está no nível máximo (3), não faz nada
   *   4. Busca o raio configurado para o próximo nível (config_sistema ou padrão)
   *   5. Encontra todos os usuários dentro do novo raio
   *   6. Filtra o dono do pet (não precisa ser notificado)
   *   7. Cria notificações em massa para os usuários no raio
   *   8. Atualiza o nivel_alerta no banco
   *
   * @param {string} petPerdidoId - UUID do alerta de pet perdido
   * @returns {Promise<object>} Resultado da escalação
   * @returns {boolean} returns.escalado - true se a escalação foi realizada
   * @returns {number} returns.nivelAnterior - Nível antes da escalação
   * @returns {number} returns.nivelAtual - Nível após a escalação
   * @returns {number} returns.raioKm - Raio usado na notificação
   * @returns {number} returns.usuariosNotificados - Quantidade de usuários notificados
   * @throws {Error} Se o alerta não for encontrado
   *
   * @example
   * const resultado = await proximidadeService.escalarAlerta('pet-perdido-uuid');
   * // resultado = {
   * //   escalado: true,
   * //   nivelAnterior: 1,
   * //   nivelAtual: 2,
   * //   raioKm: 5,
   * //   usuariosNotificados: 42
   * // }
   */
  async escalarAlerta(petPerdidoId) {
    logger.info('ProximidadeService', `Escalonamento centralizado do alerta ${petPerdidoId}`);
    return petLostAlertService.escalarOuReiniciarCiclo(petPerdidoId, {
      origem: 'proximidade_service',
      ignorarIntervaloMinimo: true,
    });
  },
};

module.exports = proximidadeService;
