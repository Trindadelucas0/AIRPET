const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const { estaAutenticado } = require('../middlewares/authMiddleware');
const { limiterGeral } = require('../middlewares/rateLimiter');

const storagePerfil = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'images', 'perfil')),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname || '.jpg')),
});
const uploadPerfil = multer({
  storage: storagePerfil,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, allowed.test(ext) && (file.mimetype && allowed.test(file.mimetype)));
  },
});

const storagePerfilCapa = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'foto_capa' ? 'capa' : 'perfil';
    cb(null, path.join(__dirname, '..', 'public', 'images', dir));
  },
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname || '.jpg')),
});
const uploadPerfilCapa = multer({
  storage: storagePerfilCapa,
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

router.use(limiterGeral);

router.get('/', async (req, res) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/feed');
  }

  let stats = { pets: 0, usuarios: 0, petshops: 0 };
  let petsPerdidosRecentes = [];

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
  } catch (e) {}

  res.render('home', { titulo: 'Inicio', stats, petsPerdidosRecentes });
});

router.get('/termos', (req, res) => res.render('termos', { titulo: 'Termos de Uso' }));
router.get('/privacidade', (req, res) => res.render('privacidade', { titulo: 'Política de Privacidade' }));

// Rotas públicas
router.use('/auth', authRoutes);
router.use('/tag', nfcRoutes);
router.use('/t', nfcRoutes);
router.use('/tags', tagRoutes);
router.use('/petshops', petshopRoutes);
router.use('/parceiros', partnerRoutes);
router.use('/petshop-panel', petshopPanelRoutes);
router.get('/api/petshops/mapa', async (req, res) => {
  const Petshop = require('../models/Petshop');
  const petshops = await Petshop.listarAtivos();
  return res.json({ sucesso: true, petshops });
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
router.get('/perfil', estaAutenticado, perfilController.mostrarPerfil);
router.put('/perfil', estaAutenticado, uploadPerfilCapa.fields([{ name: 'foto_perfil', maxCount: 1 }, { name: 'foto_capa', maxCount: 1 }]), camposPermitidos(CAMPOS_PERFIL), validarPerfil, validarResultado, perfilController.atualizar);

router.get('/perfil/galeria', estaAutenticado, perfilController.listarGaleria);
const { uploadPerfilGaleria } = require('../utils/upload');
router.post(
  '/perfil/galeria',
  estaAutenticado,
  uploadPerfilGaleria.single('foto'),
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

// Painel administrativo — rota secreta via .env (usuarios nao sabem que existe)
const adminPath = process.env.ADMIN_PATH || '/admin';
router.use(adminPath, adminRoutes);

module.exports = router;
