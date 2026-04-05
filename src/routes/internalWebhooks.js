/**
 * Webhooks internos (ex.: consumer Cloudflare Queue → HTTP para o Express).
 * Protegidos por CLOUDFLARE_QUEUE_WEBHOOK_SECRET no header X-Airpet-Webhook-Secret.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

router.post('/cloudflare-queue', (req, res) => {
  const secret = process.env.CLOUDFLARE_QUEUE_WEBHOOK_SECRET;
  if (!secret || req.get('x-airpet-webhook-secret') !== secret) {
    return res.status(401).json({ ok: false });
  }
  try {
    const body = req.body || {};
    const batch = Array.isArray(body.messages) ? body.messages : body;
    logger.info('WEBHOOK_QUEUE', 'Lote recebido da fila Cloudflare', { count: Array.isArray(batch) ? batch.length : 0 });
  } catch (e) {
    logger.error('WEBHOOK_QUEUE', 'Erro ao processar lote', e);
    return res.status(500).json({ ok: false });
  }
  return res.json({ ok: true });
});

module.exports = router;
