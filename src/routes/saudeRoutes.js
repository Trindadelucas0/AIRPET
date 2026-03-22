const express = require('express');
const router = express.Router();

const saudeController = require('../controllers/saudeController');
const { validarSaudeVacina, validarSaudeRegistro, validarResultado } = require('../middlewares/writeRouteValidators');

router.post('/:pet_id/vacinas', ...validarSaudeVacina, validarResultado, saudeController.adicionarVacina);
router.delete('/vacinas/:id', saudeController.deletarVacina);

router.post('/:pet_id/registros', ...validarSaudeRegistro, validarResultado, saudeController.adicionarRegistro);
router.delete('/registros/:id', saudeController.deletarRegistro);

module.exports = router;
