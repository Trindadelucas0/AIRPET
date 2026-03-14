/**
 * notificacaoService.js — Serviço de notificações do sistema AIRPET
 *
 * Este módulo centraliza toda a lógica de criação, entrega e gestão
 * de notificações para os usuários do sistema.
 *
 * Tipos de notificação:
 *   - 'scan': tag NFC do pet foi escaneada por alguém
 *   - 'alerta': pet perdido próximo ao usuário
 *   - 'chat': nova mensagem aprovada no chat
 *   - 'sistema': avisos do sistema (vacinas vencendo, etc.)
 *   - 'encontrado': pet encontrado (alerta resolvido)
 *
 * O método mais complexo é notificarProximos(), que usa PostGIS
 * para encontrar todos os usuários dentro de um raio geográfico
 * e criar notificações em massa sobre um pet perdido na região.
 */

const { query } = require('../config/database');
const Notificacao = require('../models/Notificacao');
const PetPerdido = require('../models/PetPerdido');
const pushService = require('./pushService');
const logger = require('../utils/logger');

const notificacaoService = {

  /**
   * Cria uma notificação para um único usuário.
   *
   * Este é o método base para notificações individuais.
   * É chamado por outros serviços (nfcService, chatService, etc.)
   * para informar o usuário sobre eventos relevantes.
   *
   * @param {string} usuarioId - UUID do usuário que receberá a notificação
   * @param {string} tipo - Tipo da notificação ('scan', 'alerta', 'chat', 'sistema', 'encontrado')
   * @param {string} mensagem - Texto descritivo da notificação (exibido na UI)
   * @param {string} [link] - URL de ação quando o usuário clica na notificação (ex: '/pet/uuid')
   * @returns {Promise<object>} O registro da notificação criada
   * @throws {Error} Se o usuarioId for inválido
   *
   * @example
   * const notif = await notificacaoService.criar(
   *   'user-uuid',
   *   'scan',
   *   'A tag de Rex foi escaneada em São Paulo.',
   *   '/pet/pet-uuid'
   * );
   */
  async criar(usuarioId, tipo, mensagem, link) {
    logger.info('NotificacaoService', `Criando notificação tipo '${tipo}' para usuário: ${usuarioId}`);

    const notificacao = await Notificacao.criar({
      usuario_id: usuarioId,
      tipo,
      mensagem,
      link: link || null,
    });

    logger.info('NotificacaoService', `Notificação criada: ${notificacao.id}`);

    const tituloMap = { scan: 'Tag Escaneada', alerta: 'Pet Perdido!', chat: 'Nova Mensagem', sistema: 'AIRPET', encontrado: 'Pet Encontrado!' };
    pushService.enviarParaUsuario(usuarioId, {
      titulo: tituloMap[tipo] || 'AIRPET',
      corpo: mensagem,
      url: link || '/notificacoes',
      tipo: tipo,
    }).catch(function (err) {
      logger.error('NotificacaoService', 'Falha ao enviar push', err);
    });

    if (this._io) {
      this._io.of('/notificacoes').to('user_' + usuarioId).emit('nova_notificacao', {
        id: notificacao.id, tipo, mensagem, link, data: notificacao.data || notificacao.data_criacao,
      });
    }

    return notificacao;
  },

  /**
   * Notifica todos os usuários dentro de um raio geográfico sobre um pet perdido.
   *
   * Este método é crucial para o sistema de alerta comunitário do AIRPET.
   * Ele funciona assim:
   *
   *   1. Busca o alerta do pet perdido para obter a última localização conhecida
   *   2. Converte o raio de km para metros (PostGIS usa metros)
   *   3. Executa uma query PostGIS com ST_DWithin para encontrar todos os
   *      usuários cuja última_localizacao está dentro do raio especificado
   *   4. Filtra o dono do pet (ele não precisa ser notificado sobre seu próprio pet)
   *   5. Cria notificações em massa para todos os usuários encontrados
   *
   * A query usa a coluna 'ultima_localizacao' (geography) da tabela usuarios,
   * que é atualizada periodicamente pelo app quando o tutor compartilha localização.
   *
   * @param {string} petPerdidoId - UUID do alerta de pet perdido (tabela pets_perdidos)
   * @param {number} raioKm - Raio de busca em quilômetros (ex: 5 = 5km)
   * @returns {Promise<Array>} Lista de notificações criadas
   * @throws {Error} Se o alerta não for encontrado ou não tiver localização
   *
   * @example
   * const notifs = await notificacaoService.notificarProximos('pet-perdido-uuid', 5);
   * // Notifica todos os usuários em um raio de 5km da última posição do pet
   * // notifs = [{ id, usuario_id, tipo: 'alerta', ... }, ...]
   */
  async notificarProximos(petPerdidoId, raioKm) {
    logger.info('NotificacaoService', `Notificando usuários próximos — alerta: ${petPerdidoId}, raio: ${raioKm}km`);

    /**
     * Busca o alerta com dados completos (JOIN com pet e dono).
     * Precisamos da localização (latitude, longitude) e do nome do pet.
     */
    const alerta = await PetPerdido.buscarPorId(petPerdidoId);

    if (!alerta) {
      throw new Error('Alerta de pet perdido não encontrado');
    }

    if (!alerta.latitude || !alerta.longitude) {
      throw new Error('Alerta sem coordenadas de localização');
    }

    /**
     * Converte o raio de quilômetros para metros.
     * PostGIS com geography (SRID 4326) trabalha em metros por padrão.
     * Ex: 5km → 5000 metros
     */
    const raioMetros = raioKm * 1000;

    /**
     * QUERY POSTGIS — Busca usuários dentro do raio.
     *
     * ST_DWithin(geometryA, geometryB, distancia):
     *   Retorna true se a distância entre os dois pontos for <= distancia.
     *   Com geography, a distância é calculada na superfície esférica da Terra.
     *
     * ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography:
     *   Cria um ponto geográfico a partir das coordenadas do pet perdido.
     *   Atenção: ST_MakePoint recebe (longitude, latitude) — ordem inversa!
     *
     * Filtros:
     *   - ultima_localizacao IS NOT NULL: ignora usuários sem localização
     *   - id != alerta.usuario_id: exclui o próprio dono do pet
     */
    const resultado = await query(
      `SELECT id
       FROM usuarios
       WHERE ultima_localizacao IS NOT NULL
         AND id != $1
         AND ST_DWithin(
               ultima_localizacao,
               ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
               $4
             )`,
      [alerta.usuario_id, alerta.latitude, alerta.longitude, raioMetros]
    );

    /* Extrai apenas os IDs dos usuários encontrados */
    const usuarioIds = resultado.rows.map(row => row.id);

    logger.info('NotificacaoService', `Encontrados ${usuarioIds.length} usuário(s) no raio de ${raioKm}km`);

    /* Se não houver ninguém no raio, retorna array vazio */
    if (usuarioIds.length === 0) {
      return [];
    }

    /**
     * Cria notificações em massa usando o método otimizado do model.
     * Utiliza unnest do PostgreSQL para inserir N registros em uma única query.
     */
    const mensagem = `🚨 Pet perdido na sua região! ${alerta.pet_nome} (${alerta.pet_raca || alerta.pet_tipo || 'pet'}) foi visto pela última vez próximo de você.`;
    const link = `/pet-perdido/${petPerdidoId}`;

    const notificacoes = await Notificacao.criarParaMultiplos(
      usuarioIds,
      'alerta',
      mensagem,
      link
    );

    logger.info('NotificacaoService', `${notificacoes.length} notificação(ões) criadas para alerta: ${petPerdidoId}`);

    pushService.enviarParaMultiplos(usuarioIds, {
      titulo: 'Pet Perdido na Sua Região!',
      corpo: mensagem,
      url: link,
      tipo: 'alerta',
    }).catch(function (err) {
      logger.error('NotificacaoService', 'Falha ao enviar push em massa', err);
    });

    if (this._io) {
      usuarioIds.forEach(uid => {
        this._io.of('/notificacoes').to('user_' + uid).emit('nova_notificacao', {
          tipo: 'alerta', mensagem, link, data: new Date(),
        });
      });
    }

    return notificacoes;
  },

  /**
   * Busca todas as notificações de um usuário.
   *
   * Retorna notificações ordenadas da mais recente para a mais antiga.
   * Inclui tanto notificações lidas quanto não lidas.
   * Usado na página de notificações e no dropdown da navbar.
   *
   * @param {string} usuarioId - UUID do usuário
   * @returns {Promise<Array>} Lista de notificações do usuário
   *
   * @example
   * const notificacoes = await notificacaoService.buscarDoUsuario('user-uuid');
   * // notificacoes = [{ id, tipo: 'scan', mensagem: '...', lida: false, ... }, ...]
   */
  async buscarDoUsuario(usuarioId) {
    logger.info('NotificacaoService', `Buscando notificações do usuário: ${usuarioId}`);

    const notificacoes = await Notificacao.buscarPorUsuario(usuarioId);

    logger.info('NotificacaoService', `Encontradas ${notificacoes.length} notificação(ões) para: ${usuarioId}`);

    return notificacoes;
  },

  /**
   * Marca uma notificação como lida.
   *
   * Chamado quando o usuário clica na notificação ou acessa
   * a página de notificações. Atualiza o campo 'lida' para true.
   *
   * @param {string} id - UUID da notificação
   * @returns {Promise<object>} Notificação atualizada com lida=true
   * @throws {Error} Se a notificação não for encontrada
   *
   * @example
   * const notif = await notificacaoService.marcarLida('notif-uuid');
   * // notif.lida = true
   */
  async marcarLida(id) {
    logger.info('NotificacaoService', `Marcando notificação como lida: ${id}`);

    const notificacao = await Notificacao.marcarComoLida(id);

    return notificacao;
  },

  /**
   * Conta o número de notificações não lidas de um usuário.
   *
   * Usado para exibir o badge/contador vermelho no ícone de
   * notificações da navbar. Retorna apenas o número inteiro.
   *
   * @param {string} usuarioId - UUID do usuário
   * @returns {Promise<number>} Quantidade de notificações não lidas (>= 0)
   *
   * @example
   * const total = await notificacaoService.contarNaoLidas('user-uuid');
   * // total = 3 (exibe "3" no badge)
   */
  async contarNaoLidas(usuarioId) {
    const total = await Notificacao.contarNaoLidas(usuarioId);

    return total;
  },
};

module.exports = notificacaoService;
