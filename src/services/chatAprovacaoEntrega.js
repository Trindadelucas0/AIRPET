/**
 * Efeitos colaterais quando uma mensagem de chat e aprovada na moderacao:
 * emite para a sala Socket.IO da conversa e cria notificacao para o destinatario.
 * Usado tanto pelo admin via WebSocket quanto pelo POST /admin/.../aprovar.
 */

const Conversa = require('../models/Conversa');
const notificacaoService = require('./notificacaoService');
const logger = require('../utils/logger');

function salaConversa(conversaId) {
  return `conversa:${String(conversaId)}`;
}

/**
 * @param {import('socket.io').Server} io
 * @param {object} msg - linha retornada por MensagemChat.aprovar (RETURNING *)
 */
async function entregarMensagemAprovada(io, msg) {
  if (!msg) return;

  if (io) {
    try {
      const chatNs = io.of('/chat');
      const room = salaConversa(msg.conversa_id);
      chatNs.to(room).emit('nova_mensagem', msg);
      chatNs.to(room).emit('mensagem_aprovada', {
        ...msg,
        remetente_id: msg.remetente,
      });
    } catch (e) {
      logger.error('ChatAprovacaoEntrega', 'Erro ao emitir socket', e);
    }
  }

  try {
    const conversa = await Conversa.buscarPorId(msg.conversa_id);
    if (!conversa) return;

    const remetenteId = parseInt(msg.remetente, 10);
    const isNumerico = !Number.isNaN(remetenteId);
    const destinatarioId = isNumerico
      ? (remetenteId === conversa.iniciador_id ? conversa.tutor_id : conversa.iniciador_id)
      : conversa.tutor_id;

    if (destinatarioId == null) return;

    const texto = (msg.conteudo || '').substring(0, 80);
    const mensagemResumo = texto ? `Nova mensagem: ${texto}${texto.length >= 80 ? '…' : ''}` : 'Nova mensagem no chat.';
    await notificacaoService.criar(
      destinatarioId,
      'chat',
      mensagemResumo,
      '/chat/' + String(msg.conversa_id),
      { remetente_id: isNumerico ? remetenteId : null }
    );
  } catch (errNotif) {
    logger.error('ChatAprovacaoEntrega', 'Erro ao criar notificacao de chat', errNotif);
  }
}

module.exports = { entregarMensagemAprovada, salaConversa };
