/**
 * adminSocket.js — Canal do admin para moderacao em tempo real
 *
 * Eventos:
 * - aprovar_mensagem: admin aprova e mensagem e entregue ao destinatario
 * - rejeitar_mensagem: admin rejeita e remetente e notificado
 */

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

    socket.on('aprovar_mensagem', async (mensagemId) => {
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

        socket.emit('mensagem_moderada', { id: mensagemId, status: 'aprovada' });
      } catch (err) {
        socket.emit('erro', { mensagem: 'Erro ao aprovar mensagem' });
      }
    });

    socket.on('rejeitar_mensagem', async (mensagemId) => {
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
    });
  });
};
