const express = require('express');
const router = express.Router();

const tagController = require('../controllers/tagController');
const { estaAutenticado } = require('../middlewares/authMiddleware');
const { apenasAdmin } = require('../middlewares/adminMiddleware');
const { limiterAtivacao } = require('../middlewares/rateLimiter');

// --- Rotas administrativas (devem vir antes das rotas com parâmetro dinâmico) ---
router.get('/admin/lista', estaAutenticado, apenasAdmin, tagController.listarTags);
router.get('/admin/lotes', estaAutenticado, apenasAdmin, tagController.listarLotes);
router.post('/admin/gerar', estaAutenticado, apenasAdmin, tagController.gerarLote);
router.post('/admin/:id/reservar', estaAutenticado, apenasAdmin, tagController.reservar);
router.post('/admin/:id/enviar', estaAutenticado, apenasAdmin, tagController.enviar);
router.post('/admin/:id/bloquear', estaAutenticado, apenasAdmin, tagController.bloquear);

// --- Rotas de ativação e vinculação (usuário autenticado) ---
router.get('/:tag_code/ativar', estaAutenticado, tagController.mostrarAtivacao);
router.post('/:tag_code/ativar', estaAutenticado, limiterAtivacao, tagController.ativar);
router.get('/:tag_code/escolher-pet', estaAutenticado, tagController.escolherPet);
router.post('/:tag_code/vincular-pet', estaAutenticado, tagController.vincularPet);

module.exports = router;
