const express = require('express');
const router = express.Router();

const petshopPanelController = require('../controllers/petshopPanelController');
const { uploadPetshopMediaMiddleware } = require('../middlewares/uploadPetshopMediaMiddleware');
const { persistSingle } = require('../middlewares/persistUploadMiddleware');
const { petshopAuthMiddleware } = require('../middlewares/petshopAuthMiddleware');
const { petshopOwnerMiddleware } = require('../middlewares/petshopOwnerMiddleware');
const { petshopApprovalMiddleware } = require('../middlewares/petshopApprovalMiddleware');
const { promotionModerationMiddleware } = require('../middlewares/promotionModerationMiddleware');
const {
  validarPetshopLogin,
  validarPetshopPerfil,
  validarPetshopServico,
  validarPetshopAgendaCriar,
  validarPetshopAgendaStatus,
  validarPetshopPost,
  validarAgendaSemBody,
  validarResultado,
} = require('../middlewares/writeRouteValidators');

router.get('/auth/login', petshopPanelController.mostrarLogin);
router.post('/auth/login', ...validarPetshopLogin, validarResultado, petshopPanelController.login);
router.get('/auth/logout', petshopPanelController.logout);

router.use(petshopAuthMiddleware, petshopOwnerMiddleware);

router.get('/dashboard', petshopPanelController.dashboard);
router.get('/vinculos/solicitacoes', petshopPanelController.listarSolicitacoesVinculo);
router.post('/perfil', ...validarPetshopPerfil, validarResultado, petshopPanelController.salvarPerfil);
router.post('/vinculos/solicitacoes/:id/aprovar', ...validarAgendaSemBody, validarResultado, petshopPanelController.aprovarSolicitacaoVinculo);
router.post('/vinculos/solicitacoes/:id/recusar', ...validarAgendaSemBody, validarResultado, petshopPanelController.recusarSolicitacaoVinculo);
router.post('/servicos', petshopApprovalMiddleware, ...validarPetshopServico, validarResultado, petshopPanelController.criarServico);
router.post('/agenda', petshopApprovalMiddleware, ...validarPetshopAgendaCriar, validarResultado, petshopPanelController.criarAgendamento);
router.post('/agenda/:id/status', petshopApprovalMiddleware, ...validarPetshopAgendaStatus, validarResultado, petshopPanelController.atualizarAgendamento);
router.post(
  '/posts',
  petshopApprovalMiddleware,
  uploadPetshopMediaMiddleware.single('foto'),
  persistSingle('petshops'),
  ...validarPetshopPost,
  validarResultado,
  promotionModerationMiddleware,
  petshopPanelController.criarPost
);

module.exports = router;
