/**
 * Factory do store de métricas.
 * METRICS_ENABLED=false desativa persistência (no-op).
 * METRICS_DRIVER=postgres (default) | memory
 */

function createMetricsStore() {
  if (String(process.env.METRICS_ENABLED || '').toLowerCase() === 'false') {
    return null;
  }
  const d = (process.env.METRICS_DRIVER || 'postgres').toLowerCase();
  if (d === 'memory') {
    return require('./memoryStore');
  }
  return require('./postgresStore');
}

module.exports = { createMetricsStore };
