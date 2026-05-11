const Notificacao = require('../models/Notificacao');
const PushSubscription = require('../models/PushSubscription');
const Pet = require('../models/Pet');
const Usuario = require('../models/Usuario');
const logger = require('../utils/logger');

const TIPOS_MENCOES = ['mencao'];
const LIMITE = 80;

async function listar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const tab = req.query.tab || 'todas';
    const petId = req.query.pet ? parseInt(req.query.pet, 10) : null;

    const pets = await Pet.buscarPorUsuario(usuarioId);

    let notificacoes;
    if (tab === 'mencoes') {
      notificacoes = await Notificacao.buscarPorTipos(usuarioId, TIPOS_MENCOES, LIMITE, petId);
    } else {
      notificacoes = await Notificacao.buscarPorUsuario(usuarioId, LIMITE, petId);
    }

    const naoLidas = await Notificacao.contarNaoLidas(usuarioId);

    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(200).json({
        sucesso: true,
        dados: notificacoes,
        naoLidas,
        tab,
        petId,
      });
    }

    return res.render('notificacoes/lista', {
      titulo: 'Notificações - AIRPET',
      notificacoes,
      naoLidas,
      tab,
      pets,
      petFiltro: petId,
    });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao listar notificações', erro);

    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao carregar notificações.',
      });
    }

    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar suas notificações.' };
    return res.redirect('/');
  }
}

async function marcarLida(req, res) {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario.id;

    const notificacao = await Notificacao.marcarComoLida(id, usuarioId);

    if (!notificacao) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Notificação não encontrada.',
      });
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Notificação marcada como lida.',
    });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao marcar notificação como lida', erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao atualizar a notificação.',
    });
  }
}

async function marcarTodasLidas(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const total = await Notificacao.marcarTodasComoLidas(usuarioId);

    return res.json({
      sucesso: true,
      mensagem: `${total} notificação(ões) marcada(s) como lida(s).`,
      total,
    });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao marcar todas como lidas', erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao marcar notificações como lidas.',
    });
  }
}

async function contarNaoLidas(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const total = await Notificacao.contarNaoLidas(usuarioId);
    return res.json({ total });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao contar notificações', erro);
    return res.json({ total: 0 });
  }
}

async function subscribe(req, res) {
  try {
    const usuarioId = req.session?.usuario?.id;
    const { subscription } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' });
    }

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ sucesso: false, mensagem: 'Subscription inválida.' });
    }

    const usuario = await Usuario.buscarPorId(usuarioId);
    if (!usuario) {
      logger.warn('NotificacaoController', `Tentativa de salvar push subscription para usuário inexistente: ${usuarioId}`);
      return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
    }

    await PushSubscription.salvar(usuarioId, subscription, req.headers['user-agent']);

    logger.info('NotificacaoController', `Push subscription salva para usuário: ${usuarioId}`);
    return res.json({ sucesso: true });
  } catch (erro) {
    if (erro?.code === '23503') {
      logger.warn('NotificacaoController', `Falha de integridade ao salvar push subscription: ${erro.constraint || 'FK'}`);
      return res.status(400).json({ sucesso: false, mensagem: 'Usuário inválido para salvar a subscription.' });
    }

    logger.error('NotificacaoController', 'Erro ao salvar push subscription', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar subscription.' });
  }
}

async function unsubscribe(req, res) {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ sucesso: false, mensagem: 'Endpoint não informado.' });
    }

    await PushSubscription.remover(endpoint);

    logger.info('NotificacaoController', 'Push subscription removida');
    return res.json({ sucesso: true });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao remover push subscription', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover subscription.' });
  }
}

/**
 * Exibe a tela de configuração de preferências de notificação.
 * Rota: GET /notificacoes/configurar
 */
async function mostrarConfigurar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const pets = await Pet.buscarPorUsuario(usuarioId);
    const petId = req.query.pet ? parseInt(req.query.pet, 10) : null;
    return res.render('notificacoes/configurar', {
      titulo: 'Configurar notificações',
      pets,
      petFiltro: petId,
    });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao carregar configurações de notificação', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar preferências.' };
    return res.redirect('/notificacoes');
  }
}

/**
 * Salva as preferências de notificação (stub — persiste em sessão enquanto não há tabela dedicada).
 * Rota: POST /notificacoes/configurar
 */
async function salvarConfigurar(req, res) {
  try {
    // Preserva preferências na sessão para uso imediato (futuro: tabela notificacao_preferencias)
    req.session.notifPrefs = {
      pet_id: req.body.pet_id || null,
      notif_racao: req.body.notif_racao === '1',
      racao_dias: parseInt(req.body.racao_dias, 10) || 30,
      notif_peso: req.body.notif_peso === '1',
      peso_dias: parseInt(req.body.peso_dias, 10) || 30,
      notif_48h: req.body.notif_48h === '1',
      notif_2h: req.body.notif_2h === '1',
      resumo_semanal: req.body.resumo_semanal === '1',
      horario_quieto: req.body.horario_quieto === '1',
      quieto_inicio: parseInt(req.body.quieto_inicio, 10) || 23,
      quieto_fim: parseInt(req.body.quieto_fim, 10) || 7,
    };
    req.session.flash = { tipo: 'sucesso', mensagem: 'Preferências de notificação salvas!' };
    return res.redirect('/notificacoes/configurar' + (req.body.pet_id ? '?pet=' + req.body.pet_id : ''));
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao salvar configurações de notificação', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar preferências.' };
    return res.redirect('/notificacoes/configurar');
  }
}

module.exports = {
  listar,
  marcarLida,
  marcarTodasLidas,
  contarNaoLidas,
  subscribe,
  unsubscribe,
  mostrarConfigurar,
  salvarConfigurar,
};
