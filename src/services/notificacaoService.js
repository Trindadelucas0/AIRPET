const Usuario = require('../models/Usuario');
const Notificacao = require('../models/Notificacao');
const PetPerdido = require('../models/PetPerdido');
const SeguidorPet = require('../models/SeguidorPet');
const ConfigSistema = require('../models/ConfigSistema');
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
  tag_post: 'Marcação em post',
  tag_post_resposta: 'Marcação em post',
  post_pet: 'Novo post de um pet que você segue',
};

function normalizarLinkNotificacao(link) {
  if (!link || typeof link !== 'string') return '/notificacoes';
  const trimmed = link.trim();
  if (!trimmed || trimmed === '#') return '/notificacoes';
  if (/^\s*javascript:/i.test(trimmed)) return '/notificacoes';
  if (!trimmed.startsWith('/')) return '/notificacoes';
  return trimmed;
}

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

    const linkNormalizado = normalizarLinkNotificacao(link);
    if (link && linkNormalizado !== link) {
      logger.warn('NotificacaoService', `Link de notificação ajustado para fallback. original='${link}' usuario=${usuarioId} tipo=${tipo}`);
    }
    logger.info('NotificacaoService', `Criando notificação tipo='${tipo}' usuario=${usuarioId} link='${linkNormalizado}'`);

    const notificacao = await Notificacao.criar({
      usuario_id: usuarioId,
      tipo,
      mensagem,
      link: linkNormalizado,
      remetente_id: remetente_id || null,
      publicacao_id: publicacao_id || null,
      pet_id: pet_id || null,
    });

    logger.info('NotificacaoService', `Notificação criada: ${notificacao.id}`);

    pushService.enviarParaUsuario(usuarioId, {
      titulo: TITULO_MAP[tipo] || 'AIRPET',
      corpo: mensagem,
      url: linkNormalizado,
      tipo: tipo,
    }).catch(function (err) {
      logger.error('NotificacaoService', 'Falha ao enviar push', err);
    });

    if (this._io) {
      this._io.of('/notificacoes').to('user_' + usuarioId).emit('nova_notificacao', {
        id: notificacao.id, tipo, mensagem, link: linkNormalizado,
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

    const lat = alerta.latitude ?? alerta.ultima_lat;
    const lng = alerta.longitude ?? alerta.ultima_lng;
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      throw new Error('Alerta sem coordenadas de localização');
    }

    const raioMetros = raioKm * 1000;

    let usuarioIds = await Usuario.listarIdsParaAlertaPerdidoProximos(
      lat,
      lng,
      raioMetros,
      alerta.usuario_id
    );

    const cooldownHoras = await ConfigSistema.buscarPorChave('alerta_cooldown_horas');
    const horasCooldown = cooldownHoras ? parseInt(cooldownHoras, 10) : 24;
    const jaNotificados = await Notificacao.buscarUsuarioIdsJaNotificadosAlerta(alerta.pet_id, horasCooldown);
    const setJaNotificados = new Set(jaNotificados);
    usuarioIds = usuarioIds.filter(id => !setJaNotificados.has(id));

    logger.info('NotificacaoService', `Encontrados ${usuarioIds.length} usuário(s) no raio de ${raioKm}km (${jaNotificados.length} já notificados no cooldown)`);

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
   * Scan da tag com GPS quando o pet está perdido: notifica seguidores e utilizadores
   * na região (opt-in `receber_alertas_pet_perdido` + `ultima_localizacao`). Dedup,
   * cooldown por pet (mesmas horas que `notificarProximos`), até 80 destinatários.
   * @param {{ petId: number, petNome: string|null, lat: number, lng: number, donoUsuarioId: number }} p
   */
  async notificarScanPetPerdidoComLocalizacao(p) {
    const { petId, petNome, lat, lng, donoUsuarioId } = p;
    const nome = petNome && String(petNome).trim() ? String(petNome).trim() : 'Pet';
    const link = `/pets/${petId}`;
    const mensagem = `Novo avistamento de ${nome}: alguém escaneou a tag com localização. Toque para ver o alerta.`;

    const [seguidores, regiaoIds] = await Promise.all([
      SeguidorPet.listarUsuarioIdsQueSeguemPetExcetoDono(petId),
      Usuario.listarIdsParaAlertaPerdidoProximos(lat, lng, 10 * 1000, donoUsuarioId),
    ]);

    const cooldownHoras = await ConfigSistema.buscarPorChave('alerta_cooldown_horas');
    const horasCooldown = cooldownHoras ? parseInt(cooldownHoras, 10) : 24;
    const jaNotificados = await Notificacao.buscarUsuarioIdsJaNotificadosAlerta(petId, horasCooldown);
    const setJa = new Set(jaNotificados);
    const donoN = Number(donoUsuarioId);

    const ordem = [];
    const visto = new Set();
    const push = (id) => {
      const uid = Number(id);
      if (!Number.isFinite(uid)) return;
      if (Number.isFinite(donoN) && uid === donoN) return;
      if (setJa.has(uid)) return;
      if (visto.has(uid)) return;
      visto.add(uid);
      ordem.push(uid);
    };
    (seguidores || []).forEach(push);
    (regiaoIds || []).forEach(push);

    const destinatarios = ordem.slice(0, 80);
    if (destinatarios.length === 0) {
      return [];
    }

    logger.info('NotificacaoService', `Scan pet perdido: ${destinatarios.length} destinatário(s) — pet=${petId}`);

    const out = [];
    for (const uid of destinatarios) {
      try {
        const n = await this.criar(uid, 'alerta', mensagem, link, { pet_id: petId });
        if (n) out.push(n);
      } catch (e) {
        logger.error('NotificacaoService', 'notificarScanPetPerdidoComLocalizacao', e);
      }
    }
    return out;
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
    const ids = await Usuario.listarIdsDentroRaioMetros(latitude, longitude, raioMetros);
    return ids.length;
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
    const usuarioIds = await Usuario.listarIdsDentroRaioMetros(latitude, longitude, raioMetros);

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

  /**
   * Conta usuários pela região cadastrada no perfil.
   * @param {{estado?: string, cidade?: string, bairro?: string, cep?: string, endereco?: string}} filtros
   * @returns {Promise<number>}
   */
  async contarUsuariosPorPerfilRegiao(filtros) {
    const usuarioIds = await Usuario.listarIdsPorFiltrosPerfilRegiao(filtros);
    return usuarioIds.length;
  },

  /**
   * Envia notificação para usuários filtrados pela região cadastrada no perfil.
   * @param {{estado?: string, cidade?: string, bairro?: string, cep?: string, endereco?: string}} filtros
   * @param {string} titulo
   * @param {string} mensagem
   * @param {string} [link]
   * @returns {Promise<Array>}
   */
  async notificarPorPerfilRegiao(filtros, titulo, mensagem, link) {
    const usuarioIds = await Usuario.listarIdsPorFiltrosPerfilRegiao(filtros);

    logger.info('NotificacaoService', `Notificar por perfil/região: ${usuarioIds.length} usuário(s)`);

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
      logger.error('NotificacaoService', 'Falha ao enviar push em massa (perfil/região)', err);
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

  /**
   * Conta usuários por cidade/estado (região cadastrada) para preview no admin.
   * Inclui quem tem cidade/estado preenchidos, com ou sem GPS.
   * @param {Array<{cidade: string, estado: string}>} cidades - Lista de pares cidade/estado
   * @returns {Promise<number>}
   */
  async contarUsuariosPorCidadeEstado(cidades) {
    if (!Array.isArray(cidades) || cidades.length === 0) return 0;
    const ids = await Usuario.listarIdsPorCidadeEstadoPairs(cidades);
    return ids.length;
  },

  /**
   * Envia notificação para usuários por cidade/estado (admin).
   * @param {Array<{cidade: string, estado: string}>} cidades
   * @param {string} titulo
   * @param {string} mensagem
   * @param {string} [link]
   * @returns {Promise<Array>}
   */
  async notificarPorCidadeEstado(cidades, titulo, mensagem, link) {
    if (!Array.isArray(cidades) || cidades.length === 0) return [];
    const usuarioIds = await Usuario.listarIdsPorCidadeEstadoPairs(cidades);
    logger.info('NotificacaoService', `Notificar por cidade/estado: ${usuarioIds.length} usuário(s)`);
    if (usuarioIds.length === 0) return [];
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
      logger.error('NotificacaoService', 'Falha ao enviar push em massa (cidade/estado)', err);
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

    let usuarioIds = await Usuario.listarIdsRecebendoAlertasPerdidoExceto(alerta.usuario_id);

    const cooldownHoras = await ConfigSistema.buscarPorChave('alerta_cooldown_horas');
    const horasCooldown = cooldownHoras ? parseInt(cooldownHoras, 10) : 24;
    const jaNotificados = await Notificacao.buscarUsuarioIdsJaNotificadosAlerta(alerta.pet_id, horasCooldown);
    const setJaNotificados = new Set(jaNotificados);
    usuarioIds = usuarioIds.filter(id => !setJaNotificados.has(id));

    logger.info('NotificacaoService', `Notificando ${usuarioIds.length} usuário(s) (todos exceto tutor; ${jaNotificados.length} já no cooldown)`);

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
