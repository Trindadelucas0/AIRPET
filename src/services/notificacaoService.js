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

function montarMensagemAlerta(alerta) {
  const base = `🚨 Pet perdido na sua região! ${alerta.pet_nome} (${alerta.pet_raca || alerta.pet_tipo || 'pet'}) foi visto pela última vez próximo de você.`;
  if (alerta.recompensa != null && String(alerta.recompensa).trim() !== '') {
    const val = String(alerta.recompensa).trim();
    if (/^\d+(\.\d+)?$/.test(val)) {
      return `${base} Recompensa: R$ ${parseFloat(val).toFixed(2).replace('.', ',')}.`;
    }
    return `${base} Recompensa oferecida: ${val}.`;
  }
  return base;
}

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

    const mensagem = montarMensagemAlerta(alerta);
    const link = `/pets/${alerta.pet_id}`;

    const notificacoes = await Notificacao.criarParaMultiplos(
      usuarioIds,
      'alerta',
      mensagem,
      link,
      alerta.pet_id
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
   * Conta usuários com ultima_localizacao dentro do raio (para preview no admin).
   * @param {number} latitude - Centro (lat)
   * @param {number} longitude - Centro (lng)
   * @param {number} raioKm - Raio em km
   * @returns {Promise<number>}
   */
  async contarUsuariosNaRegiao(latitude, longitude, raioKm) {
    const raioMetros = raioKm * 1000;
    const resultado = await query(
      `SELECT id
       FROM usuarios
       WHERE ultima_localizacao IS NOT NULL
         AND ST_DWithin(
               ultima_localizacao,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )`,
      [latitude, longitude, raioMetros]
    );
    return resultado.rows.length;
  },

  /**
   * Envia notificação in-app e push para todos os usuários dentro do raio (admin).
   * @param {number} latitude - Centro (lat)
   * @param {number} longitude - Centro (lng)
   * @param {number} raioKm - Raio em km
   * @param {string} titulo - Título da notificação (push)
   * @param {string} mensagem - Corpo da mensagem
   * @param {string} [link] - Link opcional (ex.: /mapa)
   * @returns {Promise<Array>} Lista de notificações criadas
   */
  async notificarPorRegiao(latitude, longitude, raioKm, titulo, mensagem, link) {
    const raioMetros = raioKm * 1000;
    const resultado = await query(
      `SELECT id
       FROM usuarios
       WHERE ultima_localizacao IS NOT NULL
         AND ST_DWithin(
               ultima_localizacao,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )`,
      [latitude, longitude, raioMetros]
    );
    const usuarioIds = resultado.rows.map(row => row.id);

    logger.info('NotificacaoService', `Notificar por região: ${usuarioIds.length} usuário(s) no raio de ${raioKm}km`);

    if (usuarioIds.length === 0) {
      return [];
    }

    const notificacoes = await Notificacao.criarParaMultiplos(
      usuarioIds,
      'sistema',
      mensagem,
      link || null,
      null
    );

    pushService.enviarParaMultiplos(usuarioIds, {
      titulo: titulo || TITULO_MAP.sistema || 'AIRPET',
      corpo: mensagem,
      url: link || '/notificacoes',
      tipo: 'sistema',
    }).catch(function (err) {
      logger.error('NotificacaoService', 'Falha ao enviar push em massa (região)', err);
    });

    if (this._io) {
      usuarioIds.forEach(uid => {
        this._io.of('/notificacoes').to('user_' + uid).emit('nova_notificacao', {
          tipo: 'sistema', mensagem, link: link || null, data: new Date(),
        });
      });
    }

    return notificacoes;
  },

  async notificarTodos(petPerdidoId) {
    logger.info('NotificacaoService', `Notificando todos os usuários — alerta: ${petPerdidoId}`);

    const alerta = await PetPerdido.buscarPorId(petPerdidoId);

    if (!alerta) {
      throw new Error('Alerta de pet perdido não encontrado');
    }

    const resultado = await query(
      `SELECT id FROM usuarios WHERE id != $1`,
      [alerta.usuario_id]
    );

    const usuarioIds = resultado.rows.map(row => row.id);

    logger.info('NotificacaoService', `Notificando ${usuarioIds.length} usuário(s) (todos exceto tutor)`);

    if (usuarioIds.length === 0) {
      return [];
    }

    const mensagem = montarMensagemAlerta(alerta);
    const link = `/pets/${alerta.pet_id}`;

    const notificacoes = await Notificacao.criarParaMultiplos(
      usuarioIds,
      'alerta',
      mensagem,
      link,
      alerta.pet_id
    );

    logger.info('NotificacaoService', `${notificacoes.length} notificação(ões) criadas para alerta: ${petPerdidoId}`);

    pushService.enviarParaMultiplos(usuarioIds, {
      titulo: 'Pet Perdido!',
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
