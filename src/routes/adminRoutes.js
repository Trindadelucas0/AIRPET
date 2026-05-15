const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');

const adminController = require('../controllers/adminController');
const adminDashboardController = require('../controllers/admin/adminDashboardController');
const adminAlertsController = require('../controllers/admin/adminAlertsController');
const adminMonitoramentoController = require('../controllers/adminMonitoramentoController');
const pontoMapaController = require('../controllers/pontoMapaController');
const { apenasAdmin } = require('../middlewares/adminMiddleware');
const { limiterLogin } = require('../middlewares/rateLimiter');
const { camposPermitidosSe, predicadoAdminConfigKey } = require('../middlewares/validator');
const {
  validarAdminLogin,
  validarAdminBoost,
  validarAdminRejeitarPetshop,
  validarAdminEscalar,
  validarAdminRole,
  validarAdminAparencia,
  validarAdminNotificacaoRegiao,
  validarPontoMapa,
  validarBodyVazioJson,
  validarResultado,
} = require('../middlewares/writeRouteValidators');

const { persistPwaIcons } = require('../middlewares/persistUploadMiddleware');
const uploadPwa = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(png|svg)$/i.test(file.originalname) && /image\/(png|svg\+xml)/.test(file.mimetype);
    cb(null, !!ok);
  },
});

const BASE = process.env.ADMIN_PATH || '/admin';

router.use((req, res, next) => {
  res.locals.adminPath = BASE;
  res.locals.currentPath = req.path;
  next();
});

router.get('/login', (req, res) => {
  if (req.session && req.session.admin) {
    return res.redirect(BASE);
  }
  const flash = req.session?.flash ?? null;
  if (req.session) req.session.flash = null;
  res.render('admin/login', { titulo: 'Admin Login', flash });
});

router.post('/login', limiterLogin, ...validarAdminLogin, validarResultado, async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    const adminPasswordPlain = process.env.ADMIN_PASSWORD;

    if (!adminEmail || (!adminPasswordHash && !adminPasswordPlain)) {
      if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Credenciais de admin nao configuradas no servidor.' };
      return res.redirect(BASE + '/login');
    }

    if (email !== adminEmail) {
      if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'E-mail ou senha incorretos.' };
      return res.redirect(BASE + '/login');
    }

    let senhaValida = false;
    if (adminPasswordHash) {
      senhaValida = await bcrypt.compare(senha || '', adminPasswordHash);
    } else {
      if (senha === adminPasswordPlain) senhaValida = true;
    }

    if (senhaValida) {
      if (req.session) req.session.admin = { email: adminEmail, autenticado: true };
      return res.redirect(BASE);
    }

    if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'E-mail ou senha incorretos.' };
    return res.redirect(BASE + '/login');
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('ADMIN', 'Erro ao processar login admin', err);
    if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Erro ao processar login. Tente novamente.' };
    return res.redirect(BASE + '/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.admin = null;
  res.redirect(BASE + '/login');
});

router.get('/', apenasAdmin, adminDashboardController.dashboard);
router.get('/tags', apenasAdmin, (req, res) => res.redirect('/tags/admin/lista'));
router.get('/pedidos', apenasAdmin, (req, res) => res.redirect('/tags/admin/commerce/pedidos'));
router.get('/cupons', apenasAdmin, (req, res) => res.redirect('/tags/admin/commerce/cupons'));
router.get('/analytics', apenasAdmin, adminDashboardController.mostrarAnalyticsAvancado);
router.get('/monitoramento', apenasAdmin, adminMonitoramentoController.pagina);
router.get('/api/monitoramento', apenasAdmin, adminMonitoramentoController.apiJson);
router.get('/boosts', apenasAdmin, adminDashboardController.listarBoosts);
router.get('/boosts/buscar-usuarios', apenasAdmin, adminDashboardController.buscarUsuariosParaBoost);
router.get('/boosts/buscar-pets', apenasAdmin, adminDashboardController.buscarPetsParaBoost);
router.post('/boosts', apenasAdmin, ...validarAdminBoost, validarResultado, adminDashboardController.criarBoost);
router.post('/boosts/:id/cancelar', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminDashboardController.cancelarBoost);

router.get('/usuarios', apenasAdmin, adminController.listarUsuarios);
router.get('/pets', apenasAdmin, adminController.listarPets);
router.get('/pets/:id', apenasAdmin, adminController.mostrarPetDetalhe);
router.get('/petshops', apenasAdmin, adminController.listarPetshops);
router.get('/petshops/solicitacoes', apenasAdmin, adminController.listarSolicitacoesPetshop);
router.post('/petshops/:id/aprovar', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.aprovarSolicitacaoPetshop);
router.post('/petshops/:id/rejeitar', apenasAdmin, ...validarAdminRejeitarPetshop, validarResultado, adminController.rejeitarSolicitacaoPetshop);
router.post('/petshops/:id/em-analise', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.colocarSolicitacaoPetshopEmAnalise);
router.post('/petshops/:id/suporte', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.contatarSuportePetshop);
router.post('/petshops/promocoes/:id/aprovar', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.aprovarPromocaoPetshop);
router.post('/petshops/promocoes/:id/rejeitar', apenasAdmin, ...validarAdminRejeitarPetshop, validarResultado, adminController.rejeitarPromocaoPetshop);
router.post('/petshops/:id/excluir', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.excluirPetshop);

router.get('/lista-espera', apenasAdmin, adminController.listarValidacaoInteresse);
router.get('/lista-espera/export.csv', apenasAdmin, adminController.exportarValidacaoInteresseCsv);

router.get('/pets-perdidos', apenasAdmin, adminAlertsController.listarPerdidos);
router.post('/pets-perdidos/:id/aprovar', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminAlertsController.aprovarPerdido);
router.post('/pets-perdidos/:id/rejeitar', apenasAdmin, ...validarAdminRejeitarPetshop, validarResultado, adminAlertsController.rejeitarPerdido);
router.post('/pets-perdidos/:id/escalar', apenasAdmin, ...validarAdminEscalar, validarResultado, adminAlertsController.escalarAlerta);

router.get('/moderacao', apenasAdmin, adminController.mostrarModeracao);
router.post('/moderacao/:id/aprovar', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.aprovarMensagem);
router.post('/moderacao/:id/rejeitar', apenasAdmin, ...validarAdminRejeitarPetshop, validarResultado, adminController.rejeitarMensagem);

router.post('/usuarios/:id/role', apenasAdmin, ...validarAdminRole, validarResultado, adminController.atualizarRoleUsuario);
router.post('/usuarios/:id/bloquear', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.toggleBloqueioUsuario);
router.post('/usuarios/:id/excluir', apenasAdmin, ...validarBodyVazioJson, validarResultado, adminController.excluirUsuario);

router.get('/configuracoes', apenasAdmin, adminController.mostrarConfiguracoes);
router.post('/configuracoes', apenasAdmin, camposPermitidosSe(predicadoAdminConfigKey), adminController.salvarConfiguracoes);

router.get('/aparencia', apenasAdmin, adminController.mostrarAparencia);
router.post(
  '/aparencia',
  apenasAdmin,
  uploadPwa.fields([{ name: 'icon_192', maxCount: 1 }, { name: 'icon_512', maxCount: 1 }]),
  persistPwaIcons(),
  ...validarAdminAparencia,
  validarResultado,
  adminController.salvarAparencia
);

router.get('/notificacoes/enviar/preview', apenasAdmin, adminController.previewEnviarNotificacao);
router.get('/notificacoes/enviar', apenasAdmin, adminController.mostrarEnviarNotificacao);
router.post('/notificacoes/enviar', apenasAdmin, ...validarAdminNotificacaoRegiao, validarResultado, adminController.enviarNotificacaoRegiao);

router.get('/gerenciar-mapa', apenasAdmin, adminController.mostrarGerenciarMapa);
router.get('/mapa', apenasAdmin, adminController.mostrarMapa);
router.post('/pontos-mapa', apenasAdmin, ...validarPontoMapa, validarResultado, pontoMapaController.criar);
router.put('/pontos-mapa/:id', apenasAdmin, ...validarPontoMapa, validarResultado, pontoMapaController.atualizar);
router.post('/pontos-mapa/:id/toggle', apenasAdmin, ...validarBodyVazioJson, validarResultado, pontoMapaController.ativarDesativar);
router.delete('/pontos-mapa/:id', apenasAdmin, pontoMapaController.deletar);

module.exports = router;
