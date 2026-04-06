const metricsService = require('../services/metrics/metricsService');

const getAdminPath = () => process.env.ADMIN_PATH || '/admin';

async function pagina(req, res) {
  try {
    const data = await metricsService.getSnapshotForAdmin();
    return res.render('admin/monitoramento', {
      titulo: 'Monitoramento',
      adminPath: getAdminPath(),
      ...data,
    });
  } catch (_err) {
    return res.status(500).render('partials/erro', {
      titulo: 'Erro',
      mensagem: 'Nao foi possivel carregar o monitoramento.',
      codigo: 500,
    });
  }
}

async function apiJson(req, res) {
  try {
    const data = await metricsService.getSnapshotForAdmin();
    const payload = {
      storageBytes: data.storageBytes,
      storageObjects: data.storageObjects,
      storageGb: data.storageGb,
      quotaGb: data.quotaGb,
      storagePctOfQuota: data.storagePctOfQuota,
      storageUpdatedAt: data.storageUpdatedAt,
      accessTotal: data.accessTotal,
      activeConcurrent: data.activeConcurrent,
      lastReconcileAt: data.lastReconcileAt,
      alerts: data.alerts,
      statusOk: data.statusOk,
      metricsEnabled: data.metricsEnabled,
    };
    return res.json(payload);
  } catch (_err) {
    return res.status(500).json({ erro: 'metrics_unavailable' });
  }
}

module.exports = { pagina, apiJson };
