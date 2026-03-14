const Notificacao = require('../models/Notificacao');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');

const TIPOS_MENCOES = ['mencao'];
const TIPOS_TODAS = null;

async function listar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const tab = req.query.tab || 'todas';

    let notificacoes;
    if (tab === 'mencoes') {
      notificacoes = await Notificacao.buscarPorTipos(usuarioId, TIPOS_MENCOES);
    } else {
      notificacoes = await Notificacao.buscarPorUsuario(usuarioId);
    }

    const naoLidas = await Notificacao.contarNaoLidas(usuarioId);

    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(200).json({
        sucesso: true,
        dados: notificacoes,
        naoLidas,
        tab,
      });
    }

    return res.render('notificacoes/lista', {
      titulo: 'Notificações - AIRPET',
      notificacoes,
      naoLidas,
      tab,
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
    const usuarioId = req.session.usuario.id;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ sucesso: false, mensagem: 'Subscription inválida.' });
    }

    await PushSubscription.salvar(usuarioId, subscription, req.headers['user-agent']);

    logger.info('NotificacaoController', `Push subscription salva para usuário: ${usuarioId}`);
    return res.json({ sucesso: true });
  } catch (erro) {
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

module.exports = {
  listar,
  marcarLida,
  marcarTodasLidas,
  contarNaoLidas,
  subscribe,
  unsubscribe,
};
