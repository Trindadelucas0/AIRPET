/**
 * adminSocket.js — Canal do admin para moderacao em tempo real
 *
 * Eventos:
 * - aprovar_mensagem: admin aprova e mensagem e entregue ao destinatario
 * - rejeitar_mensagem: admin rejeita e remetente e notificado
 */

const Conversa = require('../models/Conversa');
const notificacaoService = require('../services/notificacaoService');

module.exports = function (adminNs) {
  adminNs.use((socket, next) => {
    const session = socket.request.session;
    if (session?.usuario?.role === 'admin') {
      return next();
    }
    return next(new Error('Acesso negado: apenas admin'));
  });

  adminNs.on('connection', (socket) => {
    // Admin entra na sala de moderacao
    socket.join('moderacao');

    const handleAprovar = async (mensagemId) => {
      try {
        const { query } = require('../config/database');

        const resultado = await query(
          `UPDATE mensagens_chat SET status_moderacao = 'aprovada', moderado_por = $1, moderado_em = NOW()
           WHERE id = $2 RETURNING *`,
          [socket.request.session.usuario.id, mensagemId]
        );

        if (resultado.rows.length === 0) return;

        const msg = resultado.rows[0];

        // Entrega a mensagem no chat
        const chatNs = socket.nsp.server.of('/chat');
        chatNs.to(`conversa:${msg.conversa_id}`).emit('nova_mensagem', msg);

        // Notifica o destinatario (quem nao enviou) com link para a conversa
        try {
          const conversa = await Conversa.buscarPorId(msg.conversa_id);
          if (conversa) {
            const remetenteId = parseInt(msg.remetente, 10);
            const isNumerico = !Number.isNaN(remetenteId);
            const destinatarioId = isNumerico
              ? (remetenteId === conversa.iniciador_id ? conversa.tutor_id : conversa.iniciador_id)
              : conversa.tutor_id;
            const texto = (msg.conteudo || '').substring(0, 80);
            const mensagemResumo = texto ? `Nova mensagem: ${texto}${texto.length >= 80 ? '…' : ''}` : 'Nova mensagem no chat.';
            await notificacaoService.criar(destinatarioId, 'chat', mensagemResumo, '/chat/' + msg.conversa_id, { remetente_id: isNumerico ? remetenteId : null });
          }
        } catch (errNotif) {
          require('../utils/logger').error('AdminSocket', 'Erro ao criar notificacao de chat', errNotif);
        }

        socket.emit('mensagem_moderada', { id: mensagemId, status: 'aprovada' });
      } catch (err) {
        socket.emit('erro', { mensagem: 'Erro ao aprovar mensagem' });
      }
    };

    const handleRejeitar = async (mensagemId) => {
      try {
        const { query } = require('../config/database');

        await query(
          `UPDATE mensagens_chat SET status_moderacao = 'rejeitada', moderado_por = $1, moderado_em = NOW()
           WHERE id = $2`,
          [socket.request.session.usuario.id, mensagemId]
        );

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
