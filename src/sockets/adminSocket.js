/**
 * adminSocket.js — Canal do admin para moderacao em tempo real
 *
 * Eventos:
 * - aprovar_mensagem: admin aprova e mensagem e entregue ao destinatario
 * - rejeitar_mensagem: admin rejeita e remetente e notificado
 */

const MensagemChat = require('../models/MensagemChat');
const { entregarMensagemAprovada } = require('../services/chatAprovacaoEntrega');

module.exports = function (adminNs) {
  adminNs.use((socket, next) => {
    const session = socket.request.session;
    const adminViaUsuario = session?.usuario?.role === 'admin';
    const adminViaSessaoLegada = !!session?.admin;
    if (adminViaUsuario || adminViaSessaoLegada) {
      return next();
    }
    return next(new Error('Acesso negado: apenas admin'));
  });

  adminNs.on('connection', (socket) => {
    // Admin entra na sala de moderacao
    socket.join('moderacao');

    const handleAprovar = async (mensagemId) => {
      try {
        const adminId = socket.request.session?.usuario?.id || socket.request.session?.admin?.id || null;

        const msg = await MensagemChat.aprovar(mensagemId, adminId);
        if (!msg) return;

        await entregarMensagemAprovada(socket.nsp.server, msg);

        socket.emit('mensagem_moderada', { id: mensagemId, status: 'aprovada' });
      } catch (err) {
        socket.emit('erro', { mensagem: 'Erro ao aprovar mensagem' });
      }
    };

    const handleRejeitar = async (mensagemId) => {
      try {
        const adminId = socket.request.session?.usuario?.id || socket.request.session?.admin?.id || null;

        await MensagemChat.rejeitar(mensagemId, adminId);

        socket.emit('mensagem_moderada', { id: mensagemId, status: 'rejeitada' });
      } catch (err) {
        socket.emit('erro', { mensagem: 'Erro ao rejeitar mensagem' });
      }
    };

    socket.on('moderar_mensagem', async (payload) => {
      const id = (payload && typeof payload === 'object') ? payload.id : payload;
      const acao = (payload && typeof payload === 'object') ? payload.acao : 'aprovar';
      if (acao === 'rejeitar') {
        await handleRejeitar(id);
      } else {
        await handleAprovar(id);
      }
    });

    socket.on('aprovar_mensagem', handleAprovar);
    socket.on('rejeitar_mensagem', handleRejeitar);
  });
};
