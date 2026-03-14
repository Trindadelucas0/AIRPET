const express = require('express');
const router = express.Router();

const petPerdidoController = require('../controllers/petPerdidoController');

router.get('/:pet_id/formulario', petPerdidoController.mostrarFormulario);
router.post('/:pet_id/reportar', petPerdidoController.reportar);

router.get('/:pet_id/encontrado', petPerdidoController.mostrarFormularioEncontrado);
router.post('/:pet_id/encontrado', petPerdidoController.marcarEncontrado);
router.get('/:pet_id/confirmacao', petPerdidoController.mostrarConfirmacao);

router.post('/:id/resolver', petPerdidoController.resolver);

module.exports = router;
