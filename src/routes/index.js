const express = require('express');
const router = express.Router();
const { performance } = require('node:perf_hooks');
const path = require('path');
const multer = require('multer');

const { estaAutenticado } = require('../middlewares/authMiddleware');
const { limiterGeral } = require('../middlewares/rateLimiter');
const { persistFields, persistSingle } = require('../middlewares/persistUploadMiddleware');

const uploadPerfilCapa = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, allowed.test(ext) && (file.mimetype && allowed.test(file.mimetype)));
  },
});

// Sub-rotas
const authRoutes = require('./authRoutes');
const petRoutes = require('./petRoutes');
const nfcRoutes = require('./nfcRoutes');
const tagRoutes = require('./tagRoutes');
const petshopRoutes = require('./petshopRoutes');
const mapaRoutes = require('./mapaRoutes');
const notificacaoRoutes = require('./notificacaoRoutes');
const adminRoutes = require('./adminRoutes');
const localizacaoRoutes = require('./localizacaoRoutes');
const chatRoutes = require('./chatRoutes');
const saudeRoutes = require('./saudeRoutes');
const agendaRoutes = require('./agendaRoutes');
const petPerdidoRoutes = require('./petPerdidoRoutes');
const explorarRoutes = require('./explorarRoutes');
const partnerRoutes = require('./partnerRoutes');
const petshopPanelRoutes = require('./petshopPanelRoutes');

const Pet = require('../models/Pet');
const Usuario = require('../models/Usuario');
const PontoMapa = require('../models/PontoMapa');
const PetPerdido = require('../models/PetPerdido');
const petPerdidoController = require('../controllers/petPerdidoController');
const logger = require('../utils/logger');

const HOME_CACHE_TTL_MS = Math.max(parseInt(process.env.HOME_CACHE_TTL_MS || '60000', 10) || 60000, 5000);
const homePublicCache = {
  value: null,
  expiresAt: 0,
  inFlight: null,
};

async function loadHomePublicData() {
  const queryTimings = {};
  const t0 = performance.now();
  const timed = async (label, fn) => {
    const qs = performance.now();
    const result = await fn();
    queryTimings[label] = Number((performance.now() - qs).toFixed(2));
    return result;
  };

  const [petsTotal, usuariosTotal, pontosMapaAtivos, perdidosRecentes] = await Promise.all([
    timed('petsTotal', () => Pet.contarTotal()),
    timed('usuariosTotal', () => Usuario.contarTotal()),
    timed('pontosMapaAtivos', () => PontoMapa.contarAtivos()),
    timed('perdidosRecentes', () => PetPerdido.listarRecentesAprovadosParaHome(3)),
  ]);

  return {
    stats: {
      pets: petsTotal,
      usuarios: usuariosTotal,
      petshops: pontosMapaAtivos,
    },
    petsPerdidosRecentes: perdidosRecentes,
    metrics: {
      totalMs: Number((performance.now() - t0).toFixed(2)),
      queryMs: queryTimings,
    },
  };
}

async function getHomePublicDataCached() {
  const now = Date.now();
  if (homePublicCache.value && homePublicCache.expiresAt > now) {
    return { ...homePublicCache.value, cacheHit: true };
  }
  if (homePublicCache.inFlight) {
    const value = await homePublicCache.inFlight;
    return { ...value, cacheHit: true, fromInFlight: true };
  }
  homePublicCache.inFlight = (async () => {
    const value = await loadHomePublicData();
    homePublicCache.value = value;
    homePublicCache.expiresAt = Date.now() + HOME_CACHE_TTL_MS;
    return value;
  })();
  try {
    const value = await homePublicCache.inFlight;
    return { ...value, cacheHit: false };
  } finally {
    homePublicCache.inFlight = null;
  }
}

router.use(limiterGeral);

router.get('/alerta/:alertaId', petPerdidoController.mostrarAlertaPublico);

router.get('/', async (req, res) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/feed');
  }

  let stats = { pets: 0, usuarios: 0, petshops: 0 };
  let petsPerdidosRecentes = [];
  let statsCarregamentoFalhou = false;
  const reqStart = performance.now();

  try {
    const homeData = await getHomePublicDataCached();
    stats = homeData.stats;
    petsPerdidosRecentes = homeData.petsPerdidosRecentes;
    if (process.env.LOG_HOME_PERF === 'true') {
      logger.info(
        'HOME_PERF',
        `cacheHit=${homeData.cacheHit ? '1' : '0'} total=${homeData.metrics.totalMs}ms queries=${JSON.stringify(homeData.metrics.queryMs)}`
      );
    }
  } catch (e) {
    statsCarregamentoFalhou = true;
    logger.error('ROUTES', 'Erro ao carregar estatísticas da home', e);
  }

  if (process.env.LOG_HOME_PERF === 'true') {
    const totalReqMs = Number((performance.now() - reqStart).toFixed(2));
    logger.info('HOME_PERF', `requestTotal=${totalReqMs}ms`);
  }

  res.render('home', { titulo: 'Inicio', stats, petsPerdidosRecentes, statsCarregamentoFalhou });
});

router.get('/termos', (req, res) => res.render('termos', { titulo: 'Termos de Uso' }));
router.get('/privacidade', (req, res) => res.render('privacidade', { titulo: 'Política de Privacidade' }));

/** Atalho: quem acessa /planos cai na página real em /tags/planos */
router.get('/planos', (req, res) => res.redirect(302, '/tags/planos'));

// Rotas públicas
router.use('/auth', authRoutes);
router.use('/tag', nfcRoutes);
router.use('/t', nfcRoutes);
router.use('/tags', tagRoutes);
router.use('/petshops', petshopRoutes);
router.use('/parceiros', partnerRoutes);
router.use('/petshop-panel', petshopPanelRoutes);
router.get('/api/petshops/mapa', async (req, res) => {
  try {
    const Petshop = require('../models/Petshop');
    const petshops = await Petshop.listarAtivosParaMapaPublico();
    return res.json({ sucesso: true, petshops });
  } catch (err) {
    logger.error('ROUTES', 'Erro em GET /api/petshops/mapa', err);
    return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar os petshops para o mapa.' });
  }
});
router.use('/mapa', mapaRoutes);
router.use('/chat', chatRoutes);

// Rotas protegidas por autenticação
router.use('/pets', estaAutenticado, petRoutes);
router.use('/notificacoes', estaAutenticado, notificacaoRoutes);
router.use('/saude', estaAutenticado, saudeRoutes);
router.use('/agenda', estaAutenticado, agendaRoutes);
router.use('/perdidos', estaAutenticado, petPerdidoRoutes);
router.use('/explorar', estaAutenticado, explorarRoutes);
router.get('/feed', estaAutenticado, require('../controllers/explorarController').feedSeguidos);

// Perfil do usuario
const perfilController = require('../controllers/perfilController');
const { validarPerfil, validarResultado, camposPermitidos, CAMPOS_PERFIL } = require('../middlewares/validator');
const { validarPerfilGaleriaPost, validarPerfilGaleriaBody } = require('../middlewares/writeRouteValidators');
router.get('/perfil', estaAutenticado, perfilController.mostrarPerfilHub);
router.get('/perfil/conta', estaAutenticado, perfilController.mostrarConta);
router.get('/perfil/aparencia', estaAutenticado, perfilController.mostrarAparencia);
router.get('/perfil/localizacao', estaAutenticado, perfilController.mostrarLocalizacao);
router.get('/perfil/seguranca', estaAutenticado, perfilController.mostrarSeguranca);
router.get('/perfil/galeria', estaAutenticado, perfilController.mostrarGaleriaPagina);
router.put(
  '/perfil',
  estaAutenticado,
  uploadPerfilCapa.fields([{ name: 'foto_perfil', maxCount: 1 }, { name: 'foto_capa', maxCount: 1 }]),
  persistFields({ foto_perfil: 'perfil', foto_capa: 'capa' }),
  camposPermitidos(CAMPOS_PERFIL),
  validarPerfil,
  validarResultado,
  perfilController.atualizar
);

router.get('/api/perfil/galeria', estaAutenticado, perfilController.listarGaleria);
const { uploadPerfilGaleria } = require('../utils/upload');
router.post(
  '/perfil/galeria',
  estaAutenticado,
  uploadPerfilGaleria.single('foto'),
  persistSingle('perfil-galeria'),
  ...validarPerfilGaleriaPost,
  ...validarPerfilGaleriaBody,
  validarResultado,
  perfilController.adicionarFotoGaleria
);
router.delete('/perfil/galeria/:id', estaAutenticado, perfilController.removerFotoGaleria);

// API publica de racas (usada pelo autocomplete no cadastro de pet)
router.get('/api/racas', require('../controllers/perfilController').buscarRacas);

// Rotas de API (protegidas)
router.use('/api/localizacao', estaAutenticado, localizacaoRoutes);
const petController = require('../controllers/petController');
router.get('/api/pets/:id/alerta-ativo', estaAutenticado, petController.alertaAtivo.bind(petController));

router.use('/api/v1', require('./syncApiRoutes'));

// Painel administrativo — rota secreta via .env (usuarios nao sabem que existe)
const adminPath = process.env.ADMIN_PATH || '/admin';
router.use(adminPath, adminRoutes);

module.exports = router;
