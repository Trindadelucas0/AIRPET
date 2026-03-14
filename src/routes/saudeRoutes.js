const express = require('express');
const router = express.Router();

const saudeController = require('../controllers/saudeController');

router.post('/:pet_id/vacinas', saudeController.adicionarVacina);
router.delete('/vacinas/:id', saudeController.deletarVacina);

router.post('/:pet_id/registros', saudeController.adicionarRegistro);
router.delete('/registros/:id', saudeController.deletarRegistro);

module.exports = router;
