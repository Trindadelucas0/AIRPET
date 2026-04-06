const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const petshopController = require('../controllers/petshopController');
const { estaAutenticado, estaAutenticadoAPI } = require('../middlewares/authMiddleware');
const {
  validarPetshopSeguir,
  validarPetshopAvaliar,
  validarPetshopSolicitarVinculo,
  validarResultado,
} = require('../middlewares/writeRouteValidators');

// Listagem pública de petshops
router.get('/', petshopController.listar);
router.get('/mapa', petshopController.mapa);
router.get('/api/mapa', async (req, res) => {
  try {
    const Petshop = require('../models/Petshop');
    const petshops = await Petshop.listarAtivos();
    return res.json({ sucesso: true, petshops });
  } catch (err) {
    logger.error('ROUTES', 'Erro em GET /petshops/api/mapa', err);
    return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar os petshops para o mapa.' });
  }
});
router.post('/:id/seguir', estaAutenticado, ...validarPetshopSeguir, validarResultado, petshopController.seguir);
router.post('/:id/seguir-json', estaAutenticadoAPI, ...validarPetshopSeguir, validarResultado, petshopController.seguir);
router.post('/:id/avaliar', estaAutenticado, ...validarPetshopAvaliar, validarResultado, petshopController.avaliar);
router.post('/:id/solicitar-vinculo', estaAutenticadoAPI, ...validarPetshopSolicitarVinculo, validarResultado, petshopController.solicitarVinculo);

// Detalhes de um petshop específico
router.get('/:id', petshopController.mostrarDetalhes);

module.exports = router;
