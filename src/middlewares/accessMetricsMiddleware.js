/**
 * Conta acessos HTTP (Postgres) e pedidos em voo (memória por instância).
 */

const metricsService = require('../services/metrics/metricsService');

function shouldCountAccess(req) {
  if (!metricsService.isEnabled()) return false;
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS' || method === 'HEAD') return false;

  const p = req.path || req.url || '';
  if (p.startsWith('/css/')) return false;
  if (p.startsWith('/images/')) return false;
  if (p.startsWith('/js/')) return false;
  if (p === '/favicon.ico' || p.endsWith('.ico')) return false;
  if (p.startsWith('/health')) return false;
  if (p === '/manifest.json') return false;
  if (p.startsWith('/api/internal')) return false;

  return true;
}

function accessMetricsMiddleware(req, res, next) {
  if (!shouldCountAccess(req)) {
    return next();
  }

  metricsService.onHttpRequestStart();
  let ended = false;
  const done = () => {
    if (ended) return;
    ended = true;
    metricsService.onHttpRequestEnd();
  };
  res.on('finish', done);
  res.on('close', done);

  setImmediate(() => {
    metricsService.incrementAccessTotalOnce();
  });

  next();
}

module.exports = { accessMetricsMiddleware, shouldCountAccess };
