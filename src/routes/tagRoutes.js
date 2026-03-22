const express = require('express');
const router = express.Router();

const tagController = require('../controllers/tagController');
const { estaAutenticado } = require('../middlewares/authMiddleware');
const { apenasAdmin } = require('../middlewares/adminMiddleware');
const { limiterAtivacao } = require('../middlewares/rateLimiter');
const {
  validarTagGerarLote,
  validarTagReservar,
  validarTagEnviarBloquear,
  validarTagChegou,
  validarTagAtivar,
  validarTagVincularPet,
  validarResultado,
} = require('../middlewares/writeRouteValidators');

// --- Rotas administrativas (devem vir antes das rotas com parâmetro dinâmico) ---
router.get('/admin/lista', estaAutenticado, apenasAdmin, tagController.listarTags);
router.get('/admin/lotes', estaAutenticado, apenasAdmin, tagController.listarLotes);
router.get('/admin/lote/:id', estaAutenticado, apenasAdmin, tagController.mostrarLote);
router.post('/admin/gerar', estaAutenticado, apenasAdmin, ...validarTagGerarLote, validarResultado, tagController.gerarLote);
router.post('/admin/:id/reservar', estaAutenticado, apenasAdmin, ...validarTagReservar, validarResultado, tagController.reservar);
router.post('/admin/:id/enviar', estaAutenticado, apenasAdmin, ...validarTagEnviarBloquear, validarResultado, tagController.enviar);
router.post('/admin/:id/bloquear', estaAutenticado, apenasAdmin, ...validarTagEnviarBloquear, validarResultado, tagController.bloquear);

// --- Rotas de ativação e vinculação (usuário autenticado) ---
router.get('/minhas', estaAutenticado, tagController.minhasTags);
router.post('/:tag_code/chegou', estaAutenticado, ...validarTagChegou, validarResultado, tagController.minhaTagChegou);
router.get('/:tag_code/ativar', estaAutenticado, tagController.mostrarAtivacao);
router.post('/:tag_code/ativar', estaAutenticado, limiterAtivacao, ...validarTagAtivar, validarResultado, tagController.ativar);
router.get('/:tag_code/escolher-pet', estaAutenticado, tagController.escolherPet);
router.post('/:tag_code/vincular-pet', estaAutenticado, ...validarTagVincularPet, validarResultado, tagController.vincularPet);

module.exports = router;
