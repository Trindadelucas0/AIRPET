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

const { query } = require('../config/database');
const PetPerdido = require('../models/PetPerdido');
const ConfigSistema = require('../models/ConfigSistema');
const Notificacao = require('../models/Notificacao');
const logger = require('../utils/logger');

/**
 * Configurações padrão de raio por nível de alerta (em km).
 * Estes valores são usados como fallback quando as configurações
 * não estão definidas na tabela config_sistema.
 *
 * A tabela config_sistema pode sobrescrever estes valores com as chaves:
 *   - 'alerta_raio_nivel_1': raio em km para nível 1 (padrão: 2)
 *   - 'alerta_raio_nivel_2': raio em km para nível 2 (padrão: 5)
 *   - 'alerta_raio_nivel_3': raio em km para nível 3 (padrão: 15)
 */
const RAIOS_PADRAO = {
  1: 2,
  2: 5,
  3: 15,
};

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
    const resultado = await query(
      `SELECT id
       FROM usuarios
       WHERE ultima_localizacao IS NOT NULL
         AND ST_DWithin(
               ultima_localizacao,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )`,
      [lat, lng, raioMetros]
    );

    /* Extrai os UUIDs dos usuários encontrados */
    const usuarioIds = resultado.rows.map(row => row.id);

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
    logger.info('ProximidadeService', `Escalando alerta: ${petPerdidoId}`);

    /* Busca o alerta com dados completos (JOINs com pet e dono) */
    const alerta = await PetPerdido.buscarPorId(petPerdidoId);

    if (!alerta) {
      throw new Error('Alerta de pet perdido não encontrado');
    }

    /**
     * Verifica o nível atual e calcula o próximo.
     * Se o alerta já está no nível máximo (3), não escala mais.
     */
    const nivelAtual = alerta.nivel_alerta || 1;
    const proximoNivel = nivelAtual + 1;

    if (proximoNivel > 3) {
      logger.info('ProximidadeService', `Alerta ${petPerdidoId} já está no nível máximo (3)`);
      return {
        escalado: false,
        nivelAnterior: nivelAtual,
        nivelAtual: nivelAtual,
        raioKm: 0,
        usuariosNotificados: 0,
      };
    }

    /**
     * Busca o raio configurado para o próximo nível.
     * Primeiro tenta buscar da tabela config_sistema (configurável pelo admin).
     * Se não encontrar, usa o valor padrão definido em RAIOS_PADRAO.
     */
    const chaveConfig = `alerta_raio_nivel_${proximoNivel}`;
    const raioConfigurado = await ConfigSistema.buscarPorChave(chaveConfig);
    const raioKm = raioConfigurado ? parseFloat(raioConfigurado) : RAIOS_PADRAO[proximoNivel];

    logger.info('ProximidadeService', `Escalando para nível ${proximoNivel} — raio: ${raioKm}km`);

    /**
     * Busca todos os usuários dentro do novo raio expandido.
     * A busca é feita a partir da última localização conhecida do pet perdido.
     */
    const usuarioIds = await this.buscarUsuariosProximos(
      alerta.latitude,
      alerta.longitude,
      raioKm
    );

    /**
     * Filtra o dono do pet — ele não precisa receber notificação
     * sobre seu próprio pet perdido (ele já sabe).
     */
    const usuariosParaNotificar = usuarioIds.filter(id => id !== alerta.usuario_id);

    logger.info('ProximidadeService', `${usuariosParaNotificar.length} usuário(s) para notificar no raio de ${raioKm}km`);

    /* Cria notificações em massa se houver usuários no raio */
    if (usuariosParaNotificar.length > 0) {
      const mensagem = `🚨 Alerta nível ${proximoNivel}! ${alerta.pet_nome} (${alerta.pet_tipo || 'pet'}) está perdido na sua região. Última vez visto próximo de você.`;
      const link = `/pets/${alerta.pet_id}`;

      await Notificacao.criarParaMultiplos(
        usuariosParaNotificar,
        'alerta',
        mensagem,
        link
      );
    }

    /**
     * Atualiza o nível de alerta no banco de dados.
     * Isso registra que a escalação foi realizada e impede
     * que o mesmo nível seja escalado novamente.
     */
    await PetPerdido.atualizarNivel(petPerdidoId, proximoNivel);

    logger.info('ProximidadeService', `Alerta ${petPerdidoId} escalado: nível ${nivelAtual} → ${proximoNivel}`);

    return {
      escalado: true,
      nivelAnterior: nivelAtual,
      nivelAtual: proximoNivel,
      raioKm,
      usuariosNotificados: usuariosParaNotificar.length,
    };
  },
};

module.exports = proximidadeService;
