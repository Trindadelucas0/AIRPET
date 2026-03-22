const express = require('express');
const router = express.Router();

const petPerdidoController = require('../controllers/petPerdidoController');
const {
  validarPetPerdidoReportar,
  validarPetPerdidoEncontrado,
  validarPetPerdidoResolver,
  validarResultado,
} = require('../middlewares/writeRouteValidators');

router.get('/:pet_id/formulario', petPerdidoController.mostrarFormulario);
router.post('/:pet_id/reportar', ...validarPetPerdidoReportar, validarResultado, petPerdidoController.reportar);

router.get('/:pet_id/encontrado', petPerdidoController.mostrarFormularioEncontrado);
router.post('/:pet_id/encontrado', ...validarPetPerdidoEncontrado, validarResultado, petPerdidoController.marcarEncontrado);
router.get('/:pet_id/confirmacao', petPerdidoController.mostrarConfirmacao);

router.post('/:id/resolver', ...validarPetPerdidoResolver, validarResultado, petPerdidoController.resolver);

module.exports = router;
