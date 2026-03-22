const express = require('express');
const router = express.Router();

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
  const Petshop = require('../models/Petshop');
  const petshops = await Petshop.listarAtivos();
  res.json({ sucesso: true, petshops });
});
router.post('/:id/seguir', estaAutenticado, ...validarPetshopSeguir, validarResultado, petshopController.seguir);
router.post('/:id/seguir-json', estaAutenticadoAPI, ...validarPetshopSeguir, validarResultado, petshopController.seguir);
router.post('/:id/avaliar', estaAutenticado, ...validarPetshopAvaliar, validarResultado, petshopController.avaliar);
router.post('/:id/solicitar-vinculo', estaAutenticadoAPI, ...validarPetshopSolicitarVinculo, validarResultado, petshopController.solicitarVinculo);

// Detalhes de um petshop específico
router.get('/:id', petshopController.mostrarDetalhes);

module.exports = router;
