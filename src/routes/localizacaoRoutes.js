const express = require('express');
const router = express.Router();

const localizacaoController = require('../controllers/localizacaoController');

router.post('/', localizacaoController.registrar);
router.get('/:pet_id', localizacaoController.historico);

module.exports = router;
