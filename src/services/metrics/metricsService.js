/**
 * API estável de métricas para middleware, storage e admin.
 * Pedidos em voo (concurrent) são por processo Node.
 */

const logger = require('../../utils/logger');
const { createMetricsStore } = require('./metricsStore');
const { evaluateAlerts, parseEnvThresholds } = require('./alertEvaluator');

const store = createMetricsStore();

let activeConcurrent = 0;
let lastLogSignature = '';

function isEnabled() {
  return store != null;
}

function onHttpRequestStart() {
  activeConcurrent += 1;
}

function onHttpRequestEnd() {
  activeConcurrent = Math.max(0, activeConcurrent - 1);
}

function getActiveConcurrent() {
  return activeConcurrent;
}

async function recordStorageUploaded(bytes) {
  if (!isEnabled()) return;
  const n = Number(bytes) || 0;
  if (n <= 0) return;
  try {
    await store.adjustStorage(n, 1);
  } catch (err) {
    logger.warn('METRICS', 'recordStorageUploaded falhou', { message: err.message });
  }
}

async function recordStorageRemoved(bytes) {
  if (!isEnabled()) return;
  const n = Number(bytes) || 0;
  if (n <= 0) return;
  try {
    await store.adjustStorage(-n, -1);
  } catch (err) {
    logger.warn('METRICS', 'recordStorageRemoved falhou', { message: err.message });
  }
}

async function incrementAccessTotalOnce() {
  if (!isEnabled()) return;
  try {
    await store.incrementAccessTotal();
  } catch (err) {
    logger.warn('METRICS', 'incrementAccessTotalOnce falhou', { message: err.message });
  }
}

function maybeLogAlerts(alerts) {
  if (alerts.length === 0) return;
  const sig = JSON.stringify(alerts.map(a => a.type).sort());
  if (sig === lastLogSignature) return;
  lastLogSignature = sig;
  for (const a of alerts) {
    logger.warn('METRICS', a.message, { type: a.type, level: a.level });
  }
}

async function getSnapshotForAdmin() {
  const thresholds = parseEnvThresholds();
  let storageBytes = 0;
  let storageObjects = 0;
  let storageUpdatedAt = null;
  let accessTotal = 0;
  let lastReconcileAt = null;

  if (isEnabled()) {
    try {
      const agg = await store.getStorageAggregate();
      storageBytes = agg.totalBytes;
      storageObjects = agg.totalObjects;
      storageUpdatedAt = agg.updatedAt;
      accessTotal = await store.getAccessTotal();
      const meta = await store.getMeta('last_storage_reconcile_at');
      lastReconcileAt = meta.time || null;
    } catch (err) {
      logger.warn('METRICS', 'getSnapshotForAdmin leitura falhou', { message: err.message });
    }
  }

  const snapshot = {
    storageBytes,
    storageObjects,
    accessTotal,
    activeConcurrent: getActiveConcurrent(),
    thresholds,
  };

  const alerts = evaluateAlerts(snapshot);
  maybeLogAlerts(alerts);

  const quotaBytes = thresholds.quotaBytes;
  const storageGb = storageBytes / 1024 ** 3;
  const quotaGb = quotaBytes > 0 ? quotaBytes / 1024 ** 3 : null;
  const storagePctOfQuota =
    quotaBytes > 0 ? Math.min(100, (storageBytes / quotaBytes) * 100) : null;

  return {
    titulo: 'Monitoramento',
    storageBytes,
    storageObjects,
    storageGb,
    quotaGb,
    storagePctOfQuota,
    storageUpdatedAt,
    accessTotal,
    activeConcurrent: getActiveConcurrent(),
    lastReconcileAt,
    alerts,
    statusOk: alerts.length === 0,
    metricsEnabled: isEnabled(),
  };
}

module.exports = {
  isEnabled,
  onHttpRequestStart,
  onHttpRequestEnd,
  getActiveConcurrent,
  recordStorageUploaded,
  recordStorageRemoved,
  incrementAccessTotalOnce,
  getSnapshotForAdmin,
  _getStore: () => store,
};
