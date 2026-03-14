/**
 * chatSocket.js — Handlers do chat moderado via WebSocket
 *
 * Eventos:
 * - entrar_conversa: usuario entra na sala da conversa
 * - enviar_mensagem: envia mensagem (fica pendente ate admin aprovar)
 * - mensagem_aprovada: admin aprovou, entrega ao destinatario
 * - mensagem_rejeitada: admin rejeitou, notifica remetente
 */

module.exports = function (chatNs) {
  chatNs.on('connection', (socket) => {
    const session = socket.request.session;

    // Entra na sala de uma conversa especifica
    socket.on('entrar_conversa', (conversaId) => {
      socket.join(`conversa:${conversaId}`);
    });

    // Envia mensagem — salva como pendente e avisa o admin
    socket.on('enviar_mensagem', async (dados) => {
      try {
        const { query } = require('../config/database');

        const resultado = await query(
          `INSERT INTO mensagens_chat (conversa_id, remetente, tipo, conteudo, foto_url)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [dados.conversa_id, dados.remetente, dados.tipo || 'texto', dados.conteudo, dados.foto_url || null]
        );

        const mensagem = resultado.rows[0];

        // Avisa o namespace admin que tem mensagem pendente
        const adminNs = socket.nsp.server.of('/admin');
        adminNs.emit('nova_mensagem_pendente', mensagem);

        // Confirma pro remetente que a mensagem foi enviada (aguardando moderacao)
        socket.emit('mensagem_enviada', { id: mensagem.id, status: 'pendente' });
      } catch (err) {
        socket.emit('erro', { mensagem: 'Erro ao enviar mensagem' });
      }
    });

    socket.on('disconnect', () => {});
  });
};
