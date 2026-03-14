const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const adminController = require('../controllers/adminController');
const pontoMapaController = require('../controllers/pontoMapaController');
const { apenasAdmin } = require('../middlewares/adminMiddleware');
const { limiterLogin } = require('../middlewares/rateLimiter');

const BASE = process.env.ADMIN_PATH || '/admin';

router.use((req, res, next) => {
  res.locals.adminPath = BASE;
  // #region agent log
  fetch('http://127.0.0.1:7619/ingest/ae098eda-cae8-4273-b296-012a1e446933',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3944ff'},body:JSON.stringify({sessionId:'3944ff',location:'adminRoutes.js:middleware',message:'Admin router hit',data:{method:req.method,url:req.url,originalUrl:req.originalUrl,BASE},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  next();
});

router.get('/login', (req, res) => {
  if (req.session && req.session.admin) {
    return res.redirect(BASE);
  }
  const flash = req.session.flash;
  req.session.flash = null;
  res.render('admin/login', { titulo: 'Admin Login', flash });
});

router.post('/login', limiterLogin, async (req, res) => {
  const { email, senha } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminPasswordPlain = process.env.ADMIN_PASSWORD;

  // #region agent log
  fetch('http://127.0.0.1:7619/ingest/ae098eda-cae8-4273-b296-012a1e446933',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3944ff'},body:JSON.stringify({sessionId:'3944ff',location:'adminRoutes.js:POST /login',message:'Login attempt entry',data:{emailReceived:email,adminEmailConfigured:adminEmail,hasHash:!!adminPasswordHash,hasPlain:!!adminPasswordPlain,BASE},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
  // #endregion

  if (!adminEmail || (!adminPasswordHash && !adminPasswordPlain)) {
    // #region agent log
    fetch('http://127.0.0.1:7619/ingest/ae098eda-cae8-4273-b296-012a1e446933',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3944ff'},body:JSON.stringify({sessionId:'3944ff',location:'adminRoutes.js:POST /login',message:'No credentials configured',data:{},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    req.session.flash = { tipo: 'erro', mensagem: 'Credenciais de admin nao configuradas no servidor.' };
    return res.redirect(BASE + '/login');
  }

  if (email !== adminEmail) {
    // #region agent log
    fetch('http://127.0.0.1:7619/ingest/ae098eda-cae8-4273-b296-012a1e446933',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3944ff'},body:JSON.stringify({sessionId:'3944ff',location:'adminRoutes.js:POST /login',message:'Email mismatch',data:{emailReceived:email,adminEmail},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    req.session.flash = { tipo: 'erro', mensagem: 'E-mail ou senha incorretos.' };
    return res.redirect(BASE + '/login');
  }

  let senhaValida = false;
  if (adminPasswordHash) {
    senhaValida = await bcrypt.compare(senha, adminPasswordHash);
  } else {
    if (senha === adminPasswordPlain) senhaValida = true;
  }

  // #region agent log
  fetch('http://127.0.0.1:7619/ingest/ae098eda-cae8-4273-b296-012a1e446933',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3944ff'},body:JSON.stringify({sessionId:'3944ff',location:'adminRoutes.js:POST /login',message:'Password validation result',data:{senhaValida,usedHash:!!adminPasswordHash,redirectTo:senhaValida?BASE:BASE+'/login'},timestamp:Date.now(),hypothesisId:'H3-H4'})}).catch(()=>{});
  // #endregion

  if (senhaValida) {
    req.session.admin = { email: adminEmail, autenticado: true };
    return res.redirect(BASE);
  }

  req.session.flash = { tipo: 'erro', mensagem: 'E-mail ou senha incorretos.' };
  return res.redirect(BASE + '/login');
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

router.get('/configuracoes', apenasAdmin, adminController.mostrarConfiguracoes);
router.post('/configuracoes', apenasAdmin, adminController.salvarConfiguracoes);

router.get('/gerenciar-mapa', apenasAdmin, adminController.mostrarGerenciarMapa);
router.get('/mapa', apenasAdmin, adminController.mostrarMapa);
router.post('/pontos-mapa', apenasAdmin, pontoMapaController.criar);
router.put('/pontos-mapa/:id', apenasAdmin, pontoMapaController.atualizar);
router.post('/pontos-mapa/:id/toggle', apenasAdmin, pontoMapaController.ativarDesativar);
router.delete('/pontos-mapa/:id', apenasAdmin, pontoMapaController.deletar);

module.exports = router;
