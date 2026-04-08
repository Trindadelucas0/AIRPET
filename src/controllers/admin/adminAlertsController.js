const adminController = require('../adminController');

module.exports = {
  listarPerdidos: adminController.listarPerdidos,
  aprovarPerdido: adminController.aprovarPerdido,
  rejeitarPerdido: adminController.rejeitarPerdido,
  escalarAlerta: adminController.escalarAlerta,
};
