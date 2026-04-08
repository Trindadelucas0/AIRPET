const express = require('express');
const router = express.Router();
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

router.use(limiterGeral);

router.get('/alerta/:alertaId', petPerdidoController.mostrarAlertaPublico);

router.get('/', async (req, res) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/feed');
  }

  let stats = { pets: 0, usuarios: 0, petshops: 0 };
  let petsPerdidosRecentes = [];
  let statsCarregamentoFalhou = false;

  try {
    const [petsTotal, usuariosTotal, pontosMapaAtivos, perdidosRecentes] = await Promise.all([
      Pet.contarTotal(),
      Usuario.contarTotal(),
      PontoMapa.contarAtivos(),
      PetPerdido.listarRecentesAprovadosParaHome(3),
    ]);
    stats = {
      pets: petsTotal,
      usuarios: usuariosTotal,
      petshops: pontosMapaAtivos,
    };
    petsPerdidosRecentes = perdidosRecentes;
  } catch (e) {
    statsCarregamentoFalhou = true;
    logger.error('ROUTES', 'Erro ao carregar estatísticas da home', e);
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
