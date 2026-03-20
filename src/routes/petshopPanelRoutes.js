const express = require('express');
const router = express.Router();

const petshopPanelController = require('../controllers/petshopPanelController');
const { uploadPetshopMediaMiddleware } = require('../middlewares/uploadPetshopMediaMiddleware');
const { petshopAuthMiddleware } = require('../middlewares/petshopAuthMiddleware');
const { petshopOwnerMiddleware } = require('../middlewares/petshopOwnerMiddleware');
const { petshopApprovalMiddleware } = require('../middlewares/petshopApprovalMiddleware');
const { promotionModerationMiddleware } = require('../middlewares/promotionModerationMiddleware');

router.get('/auth/login', petshopPanelController.mostrarLogin);
router.post('/auth/login', petshopPanelController.login);
router.get('/auth/logout', petshopPanelController.logout);

router.use(petshopAuthMiddleware, petshopOwnerMiddleware);

router.get('/dashboard', petshopPanelController.dashboard);
router.get('/vinculos/solicitacoes', petshopPanelController.listarSolicitacoesVinculo);
router.post('/perfil', petshopPanelController.salvarPerfil);
router.post('/vinculos/solicitacoes/:id/aprovar', petshopPanelController.aprovarSolicitacaoVinculo);
router.post('/vinculos/solicitacoes/:id/recusar', petshopPanelController.recusarSolicitacaoVinculo);
router.post('/servicos', petshopApprovalMiddleware, petshopPanelController.criarServico);
router.post('/agenda', petshopApprovalMiddleware, petshopPanelController.criarAgendamento);
router.post('/agenda/:id/status', petshopApprovalMiddleware, petshopPanelController.atualizarAgendamento);
router.post(
  '/posts',
  petshopApprovalMiddleware,
  uploadPetshopMediaMiddleware.single('foto'),
  promotionModerationMiddleware,
  petshopPanelController.criarPost
);

module.exports = router;
