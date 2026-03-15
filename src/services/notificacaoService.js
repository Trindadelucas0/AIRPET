const { query } = require('../config/database');
const Notificacao = require('../models/Notificacao');
const PetPerdido = require('../models/PetPerdido');
const pushService = require('./pushService');
const logger = require('../utils/logger');

const TITULO_MAP = {
  scan: 'Tag Escaneada',
  alerta: 'Pet Perdido!',
  chat: 'Nova Mensagem',
  sistema: 'AIRPET',
  encontrado: 'Pet Encontrado!',
  mencao: 'Você foi mencionado',
  curtida: 'Nova Curtida',
  comentario: 'Novo Comentário',
  repost: 'Novo Repost',
  seguidor: 'Novo Seguidor',
};

const notificacaoService = {

  async criar(usuarioId, tipo, mensagem, link, opcoes = {}) {
    const { remetente_id, publicacao_id, pet_id } = opcoes;

    if (remetente_id && parseInt(remetente_id) === parseInt(usuarioId)) {
      return null;
    }

    logger.info('NotificacaoService', `Criando notificação tipo '${tipo}' para usuário: ${usuarioId}`);

    const notificacao = await Notificacao.criar({
      usuario_id: usuarioId,
      tipo,
      mensagem,
      link: link || null,
      remetente_id: remetente_id || null,
      publicacao_id: publicacao_id || null,
      pet_id: pet_id || null,
    });

    logger.info('NotificacaoService', `Notificação criada: ${notificacao.id}`);

    pushService.enviarParaUsuario(usuarioId, {
      titulo: TITULO_MAP[tipo] || 'AIRPET',
      corpo: mensagem,
      url: link || '/notificacoes',
      tipo: tipo,
    }).catch(function (err) {
      logger.error('NotificacaoService', 'Falha ao enviar push', err);
    });

    if (this._io) {
      this._io.of('/notificacoes').to('user_' + usuarioId).emit('nova_notificacao', {
        id: notificacao.id, tipo, mensagem, link,
        data: notificacao.data_criacao || notificacao.data,
        remetente_id: remetente_id || null,
        pet_id: pet_id || null,
      });
    }

    return notificacao;
  },

  async notificarProximos(petPerdidoId, raioKm) {
    logger.info('NotificacaoService', `Notificando usuários próximos — alerta: ${petPerdidoId}, raio: ${raioKm}km`);

    const alerta = await PetPerdido.buscarPorId(petPerdidoId);

    if (!alerta) {
      throw new Error('Alerta de pet perdido não encontrado');
    }

    if (!alerta.latitude || !alerta.longitude) {
      throw new Error('Alerta sem coordenadas de localização');
    }

    const raioMetros = raioKm * 1000;

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

    const usuarioIds = resultado.rows.map(row => row.id);

    logger.info('NotificacaoService', `Encontrados ${usuarioIds.length} usuário(s) no raio de ${raioKm}km`);

    if (usuarioIds.length === 0) {
      return [];
    }

    const mensagem = `🚨 Pet perdido na sua região! ${alerta.pet_nome} (${alerta.pet_raca || alerta.pet_tipo || 'pet'}) foi visto pela última vez próximo de você.`;
    const link = `/pets/${alerta.pet_id}`;

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

  async buscarDoUsuario(usuarioId) {
    return Notificacao.buscarPorUsuario(usuarioId);
  },

  async marcarLida(id, usuarioId) {
    return Notificacao.marcarComoLida(id, usuarioId);
  },

  async contarNaoLidas(usuarioId) {
    return Notificacao.contarNaoLidas(usuarioId);
  },
};

module.exports = notificacaoService;
