const { query } = require('../config/database');
const Notificacao = require('../models/Notificacao');
const PetPerdido = require('../models/PetPerdido');
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

function montarWherePerfilRegiao(filtros = {}) {
  const condicoes = [];
  const valores = [];

  function adicionarIgual(coluna, valor) {
    if (!valor || !String(valor).trim()) return;
    valores.push(String(valor).trim());
    condicoes.push(`LOWER(TRIM(${coluna})) = LOWER(TRIM($${valores.length}))`);
  }

  adicionarIgual('estado', filtros.estado);
  adicionarIgual('cidade', filtros.cidade);
  adicionarIgual('bairro', filtros.bairro);
  adicionarIgual('cep', filtros.cep);

  if (filtros.endereco && String(filtros.endereco).trim()) {
    valores.push(`%${String(filtros.endereco).trim()}%`);
    condicoes.push(`endereco ILIKE $${valores.length}`);
  }

  return { condicoes, valores };
}

async function buscarIdsUsuariosPorPerfilRegiao(filtros = {}) {
  const { condicoes, valores } = montarWherePerfilRegiao(filtros);
  if (!condicoes.length) return [];

  const resultado = await query(
    `SELECT id
     FROM usuarios
     WHERE ${condicoes.join(' AND ')}`,
    valores
  );

  return resultado.rows.map(row => row.id);
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
         AND (receber_alertas_pet_perdido IS NULL OR receber_alertas_pet_perdido = true)
         AND ST_DWithin(
               ultima_localizacao,
               ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
               $4
             )`,
      [alerta.usuario_id, alerta.latitude, alerta.longitude, raioMetros]
    );

    let usuarioIds = resultado.rows.map(row => row.id);

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

  /**
   * Conta usuários pela região cadastrada no perfil.
   * @param {{estado?: string, cidade?: string, bairro?: string, cep?: string, endereco?: string}} filtros
   * @returns {Promise<number>}
   */
  async contarUsuariosPorPerfilRegiao(filtros) {
    const usuarioIds = await buscarIdsUsuariosPorPerfilRegiao(filtros);
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
    const usuarioIds = await buscarIdsUsuariosPorPerfilRegiao(filtros);

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
    const condicoes = cidades.map((_, i) => `(cidade = $${2 * i + 1} AND estado = $${2 * i + 2})`).join(' OR ');
    const valores = cidades.flatMap(c => [String(c.cidade).trim(), String(c.estado).trim()]);
    const resultado = await query(
      `SELECT id FROM usuarios WHERE (${condicoes})`,
      valores
    );
    return resultado.rows.length;
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
    const condicoes = cidades.map((_, i) => `(cidade = $${2 * i + 1} AND estado = $${2 * i + 2})`).join(' OR ');
    const valores = cidades.flatMap(c => [String(c.cidade).trim(), String(c.estado).trim()]);
    const resultado = await query(
      `SELECT id FROM usuarios WHERE (${condicoes})`,
      valores
    );
    const usuarioIds = resultado.rows.map(row => row.id);
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

    const resultado = await query(
      `SELECT id FROM usuarios
       WHERE id != $1
         AND (receber_alertas_pet_perdido IS NULL OR receber_alertas_pet_perdido = true)`,
      [alerta.usuario_id]
    );

    let usuarioIds = resultado.rows.map(row => row.id);

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
