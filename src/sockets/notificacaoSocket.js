/**
 * notificacaoSocket.js — Namespace /notificacoes do Socket.IO
 *
 * Cada usuario autenticado entra na sala "user_{id}"
 * para receber notificacoes em tempo real.
 */

module.exports = function (nsp) {
  nsp.use(function (socket, next) {
    var req = socket.request;
    if (req.session && req.session.usuario && req.session.usuario.id) {
      socket.userId = req.session.usuario.id;
      return next();
    }
    next(new Error('Nao autenticado'));
  });

  nsp.on('connection', function (socket) {
    socket.join('user_' + socket.userId);

    socket.on('disconnect', function () {});
  });
};
