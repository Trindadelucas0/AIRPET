/**
 * pushService.js — Serviço de envio de Web Push Notifications
 *
 * Usa a lib web-push para enviar notificações push para
 * dispositivos que possuem subscription ativa.
 * Integrado ao notificacaoService para envio automático.
 */

const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@airpet.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  logger.info('PushService', 'VAPID configurado com sucesso');
} else {
  logger.warn('PushService', 'VAPID keys não configuradas — push desabilitado');
}

const pushService = {

  async enviarParaUsuario(usuarioId, payload) {
    if (!vapidPublicKey || !vapidPrivateKey) return;

    try {
      const subscriptions = await PushSubscription.buscarPorUsuario(usuarioId);

      if (subscriptions.length === 0) return;

      const dados = JSON.stringify(payload);

      const promises = subscriptions.map(function (sub) {
        var pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };

        return webpush.sendNotification(pushSub, dados).catch(function (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            logger.info('PushService', 'Subscription expirada, removendo: ' + sub.id);
            return PushSubscription.removerPorId(sub.id);
          }
          logger.error('PushService', 'Erro ao enviar push', err);
        });
      });

      await Promise.allSettled(promises);
    } catch (err) {
      logger.error('PushService', 'Erro no enviarParaUsuario', err);
    }
  },

  async enviarParaMultiplos(usuarioIds, payload) {
    if (!vapidPublicKey || !vapidPrivateKey) return;
    if (!usuarioIds || usuarioIds.length === 0) return;

    try {
      const subscriptions = await PushSubscription.buscarPorUsuarios(usuarioIds);

      if (subscriptions.length === 0) return;

      const dados = JSON.stringify(payload);

      const promises = subscriptions.map(function (sub) {
        var pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };

        return webpush.sendNotification(pushSub, dados).catch(function (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            return PushSubscription.removerPorId(sub.id);
          }
          logger.error('PushService', 'Erro ao enviar push em massa', err);
        });
      });

      await Promise.allSettled(promises);
      logger.info('PushService', `Push enviado para ${subscriptions.length} subscription(s)`);
    } catch (err) {
      logger.error('PushService', 'Erro no enviarParaMultiplos', err);
    }
  },
};

module.exports = pushService;
