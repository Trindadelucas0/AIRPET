const express = require('express');
const router = express.Router();

const localizacaoController = require('../controllers/localizacaoController');
const { validarLocalizacaoApi, validarResultado } = require('../middlewares/writeRouteValidators');

router.post('/', ...validarLocalizacaoApi, validarResultado, localizacaoController.registrar);
router.get('/:pet_id', localizacaoController.historico);

module.exports = router;
