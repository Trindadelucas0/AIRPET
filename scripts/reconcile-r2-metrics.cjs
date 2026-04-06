#!/usr/bin/env node
/**
 * Reconcilia app_metrics_storage_aggregate com o bucket R2 (ou pasta public/images em local).
 * Uso: node scripts/reconcile-r2-metrics.cjs
 * Requer .env com DB_* e credenciais R2 se STORAGE_DRIVER=r2.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const { reconcileStorageFromSource } = require('../src/services/metrics/storageMetricsProvider');
  const out = await reconcileStorageFromSource();
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
