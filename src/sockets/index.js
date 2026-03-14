/**
 * sockets/index.js — Inicializacao do Socket.IO
 *
 * Registra namespaces para chat moderado, painel admin e notificacoes.
 * A session do Express ja e compartilhada via io.engine.use() no server.js.
 */

const chatSocket = require('./chatSocket');
const adminSocket = require('./adminSocket');
const notificacaoSocket = require('./notificacaoSocket');

module.exports = function (io) {
  const chatNs = io.of('/chat');
  chatSocket(chatNs);

  const adminNs = io.of('/admin');
  adminSocket(adminNs);

  const notifNs = io.of('/notificacoes');
  notificacaoSocket(notifNs);
};
