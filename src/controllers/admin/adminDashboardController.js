const adminController = require('../adminController');

module.exports = {
  dashboard: adminController.dashboard,
  mostrarAnalyticsAvancado: adminController.mostrarAnalyticsAvancado,
  listarBoosts: adminController.listarBoosts,
  buscarUsuariosParaBoost: adminController.buscarUsuariosParaBoost,
  buscarPetsParaBoost: adminController.buscarPetsParaBoost,
  criarBoost: adminController.criarBoost,
  cancelarBoost: adminController.cancelarBoost,
};
