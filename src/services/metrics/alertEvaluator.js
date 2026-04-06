/**
 * Regras de alerta (função pura). Limites vêm do snapshot.thresholds.
 * @param {object} snapshot
 * @param {bigint|number} snapshot.storageBytes
 * @param {bigint|number} snapshot.storageObjects
 * @param {bigint|number} snapshot.accessTotal
 * @param {number} snapshot.activeConcurrent
 * @param {object} snapshot.thresholds
 * @returns {{ type: string, level: string, message: string }[]}
 */
function evaluateAlerts(snapshot) {
  const t = snapshot.thresholds || {};
  const alerts = [];

  const quotaBytes = t.quotaBytes > 0 ? t.quotaBytes : 0;
  const storageBytes = Number(snapshot.storageBytes) || 0;
  const pctThreshold = t.storageAlertPct > 0 ? t.storageAlertPct : 80;

  if (quotaBytes > 0) {
    const pct = (storageBytes / quotaBytes) * 100;
    if (pct >= pctThreshold) {
      alerts.push({
        type: 'storage_quota',
        level: 'warning',
        message: `Armazenamento em ~${pct.toFixed(1)}% da quota (${(storageBytes / (1024 ** 3)).toFixed(2)} GB / ${(quotaBytes / (1024 ** 3)).toFixed(2)} GB).`,
      });
    }
  }

  const concurrentLimit = t.accessAlertConcurrent > 0 ? t.accessAlertConcurrent : 0;
  if (concurrentLimit > 0) {
    const ac = Number(snapshot.activeConcurrent) || 0;
    if (ac >= concurrentLimit) {
      alerts.push({
        type: 'access_concurrent',
        level: 'warning',
        message: `Pedidos em voo (${ac}) atingiram o limiar (${concurrentLimit}) nesta instância.`,
      });
    }
  }

  const visitMin = t.accessAlertTotalVisits > 0 ? t.accessAlertTotalVisits : 0;
  if (visitMin > 0) {
    const total = Number(snapshot.accessTotal) || 0;
    if (total >= visitMin) {
      alerts.push({
        type: 'access_total',
        level: 'info',
        message: `Total de acessos contados (${total}) atingiu ou ultrapassou o limiar (${visitMin}).`,
      });
    }
  }

  const milestones = Array.isArray(t.visitMilestones) ? t.visitMilestones : [];
  const totalVisits = Number(snapshot.accessTotal) || 0;
  for (const m of milestones) {
    const n = Number(m);
    if (Number.isFinite(n) && n > 0 && totalVisits >= n) {
      alerts.push({
        type: `visit_milestone_${n}`,
        level: 'info',
        message: `Marco de acessos: ${totalVisits} ≥ ${n}.`,
      });
    }
  }

  return alerts;
}

function parseEnvThresholds() {
  const gb = parseFloat(process.env.STORAGE_QUOTA_GB || '0');
  const bytesEnv = parseInt(process.env.STORAGE_QUOTA_BYTES || '0', 10);
  let quotaBytes = 0;
  if (Number.isFinite(bytesEnv) && bytesEnv > 0) quotaBytes = bytesEnv;
  else if (Number.isFinite(gb) && gb > 0) quotaBytes = Math.floor(gb * 1024 ** 3);

  const storageAlertPct = parseInt(process.env.STORAGE_ALERT_THRESHOLD_PCT || '80', 10) || 80;
  const accessAlertConcurrent = parseInt(process.env.ACCESS_ALERT_CONCURRENT || '0', 10) || 0;
  const accessAlertTotalVisits = parseInt(process.env.ACCESS_ALERT_TOTAL_VISITS || '0', 10) || 0;

  let visitMilestones = [];
  const raw = (process.env.ACCESS_ALERT_VISIT_MILESTONES || '').trim();
  if (raw) {
    visitMilestones = raw
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n > 0);
  }

  return {
    quotaBytes,
    storageAlertPct,
    accessAlertConcurrent,
    accessAlertTotalVisits,
    visitMilestones,
  };
}

module.exports = { evaluateAlerts, parseEnvThresholds };
