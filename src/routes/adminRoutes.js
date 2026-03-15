const express = require('express');
const router = express.Router();
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');

const adminController = require('../controllers/adminController');
const pontoMapaController = require('../controllers/pontoMapaController');
const { apenasAdmin } = require('../middlewares/adminMiddleware');
const { limiterLogin } = require('../middlewares/rateLimiter');

const pwaDir = path.join(__dirname, '..', 'public', 'images', 'pwa');
const storagePwa = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pwaDir),
  filename: (req, file, cb) => {
    const rawExt = (path.extname(file.originalname) || '.png').toLowerCase();
    const ext = rawExt === '.svg' ? '.svg' : '.png';
    const name = file.fieldname === 'icon_192' ? 'icon-192' : 'icon-512';
    cb(null, name + ext);
  },
});
const uploadPwa = multer({
  storage: storagePwa,
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

router.post('/login', limiterLogin, async (req, res) => {
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

router.get('/', apenasAdmin, adminController.dashboard);

router.get('/usuarios', apenasAdmin, adminController.listarUsuarios);
router.get('/pets', apenasAdmin, adminController.listarPets);
router.get('/petshops', apenasAdmin, adminController.listarPetshops);

router.get('/pets-perdidos', apenasAdmin, adminController.listarPerdidos);
router.post('/pets-perdidos/:id/aprovar', apenasAdmin, adminController.aprovarPerdido);
router.post('/pets-perdidos/:id/rejeitar', apenasAdmin, adminController.rejeitarPerdido);
router.post('/pets-perdidos/:id/escalar', apenasAdmin, adminController.escalarAlerta);

router.get('/moderacao', apenasAdmin, adminController.mostrarModeracao);
router.post('/moderacao/:id/aprovar', apenasAdmin, adminController.aprovarMensagem);
router.post('/moderacao/:id/rejeitar', apenasAdmin, adminController.rejeitarMensagem);

router.post('/usuarios/:id/role', apenasAdmin, adminController.atualizarRoleUsuario);
router.post('/usuarios/:id/bloquear', apenasAdmin, adminController.toggleBloqueioUsuario);
router.post('/usuarios/:id/excluir', apenasAdmin, adminController.excluirUsuario);

router.get('/configuracoes', apenasAdmin, adminController.mostrarConfiguracoes);
router.post('/configuracoes', apenasAdmin, adminController.salvarConfiguracoes);

router.get('/aparencia', apenasAdmin, adminController.mostrarAparencia);
router.post('/aparencia', apenasAdmin, uploadPwa.fields([{ name: 'icon_192', maxCount: 1 }, { name: 'icon_512', maxCount: 1 }]), adminController.salvarAparencia);

router.get('/gerenciar-mapa', apenasAdmin, adminController.mostrarGerenciarMapa);
router.get('/mapa', apenasAdmin, adminController.mostrarMapa);
router.post('/pontos-mapa', apenasAdmin, pontoMapaController.criar);
router.put('/pontos-mapa/:id', apenasAdmin, pontoMapaController.atualizar);
router.post('/pontos-mapa/:id/toggle', apenasAdmin, pontoMapaController.ativarDesativar);
router.delete('/pontos-mapa/:id', apenasAdmin, pontoMapaController.deletar);

module.exports = router;
