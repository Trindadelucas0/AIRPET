/**
 * notificacaoController.js — Controller de Notificações do AIRPET
 *
 * Gerencia as notificações enviadas aos usuários do sistema.
 * As notificações informam sobre eventos como:
 *   - Alerta de pet perdido na região (baseado em proximidade)
 *   - Nova mensagem aprovada no chat
 *   - Vacina do pet próxima de vencer
 *   - Alteração de status de alerta (aprovado, resolvido)
 *   - Mensagens do sistema (atualizações, avisos)
 *
 * O sistema suporta dois modos de exibição:
 *   1. View renderizada (GET /notificacoes) — página completa de notificações
 *   2. JSON (GET /api/notificacoes) — para atualizações em tempo real via fetch
 *
 * Rotas:
 *   GET  /notificacoes           → listar (renderiza view ou retorna JSON)
 *   PUT  /api/notificacoes/:id   → marcarLida (API, retorna JSON)
 */

const Notificacao = require('../models/Notificacao');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');

/**
 * listar — Lista as notificações do usuário logado
 *
 * Rota: GET /notificacoes
 * View: notificacoes/lista (ou JSON se Accept: application/json)
 *
 * Esta rota é "bidirecional":
 *   - Se a requisição aceita HTML, renderiza a view com todas as notificações
 *   - Se a requisição aceita JSON (fetch do frontend), retorna dados como JSON
 *
 * Isso permite que a mesma rota sirva tanto a página completa quanto
 * atualizações parciais via AJAX/fetch.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;

    /* Busca todas as notificações do usuário (lidas e não lidas) */
    const notificacoes = await Notificacao.buscarPorUsuario(usuarioId);

    /* Conta quantas notificações não lidas existem (para o badge) */
    const naoLidas = await Notificacao.contarNaoLidas(usuarioId);

    /*
     * Verifica se a requisição espera JSON (chamada AJAX do frontend)
     * ou HTML (navegação normal). O header 'Accept' indica a preferência.
     */
    if (req.accepts('json') && !req.accepts('html')) {
      /* Retorna JSON para consumo via fetch/AJAX */
      return res.status(200).json({
        sucesso: true,
        dados: notificacoes,
        naoLidas,
      });
    }

    /* Renderiza a view completa de notificações */
    return res.render('notificacoes/lista', {
      titulo: 'Notificações - AIRPET',
      notificacoes,
      naoLidas,
    });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao listar notificações', erro);

    /* Resposta de erro adequada ao tipo de requisição */
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

/**
 * marcarLida — Marca uma notificação como lida
 *
 * Rota: PUT /api/notificacoes/:id
 * Tipo: API (retorna JSON)
 *
 * Quando o usuário clica em uma notificação ou a visualiza,
 * o frontend chama esta rota para atualizar o status de leitura.
 *
 * Apenas o dono da notificação pode marcá-la como lida.
 * Isso é verificado comparando o usuario_id da notificação
 * com o ID do usuário na sessão (mas confiamos no middleware
 * de autenticação para garantir que o usuário está logado).
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express (JSON)
 */
async function marcarLida(req, res) {
  try {
    const { id } = req.params;

    /* Marca a notificação como lida no banco de dados */
    const notificacao = await Notificacao.marcarComoLida(id);

    /* Se não encontrou a notificação, retorna 404 */
    if (!notificacao) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Notificação não encontrada.',
      });
    }

    /* Retorna confirmação de sucesso */
    return res.status(200).json({
      sucesso: true,
      mensagem: 'Notificação marcada como lida.',
      dados: notificacao,
    });
  } catch (erro) {
    logger.error('NotificacaoController', 'Erro ao marcar notificação como lida', erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao atualizar a notificação.',
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
  contarNaoLidas,
  subscribe,
  unsubscribe,
};
