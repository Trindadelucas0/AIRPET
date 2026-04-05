const express = require('express');
const router = express.Router();

const publicPartnerController = require('../controllers/publicPartnerController');
const { uploadPetshopMediaMiddleware } = require('../middlewares/uploadPetshopMediaMiddleware');
const { persistPartnerPetshopUploads } = require('../middlewares/persistUploadMiddleware');
const { rateLimitPartnerSignupMiddleware } = require('../middlewares/rateLimitPartnerSignupMiddleware');
const { geoValidationMiddleware } = require('../middlewares/geoValidationMiddleware');
const { validarParceiroCadastro, validarResultado } = require('../middlewares/writeRouteValidators');

router.get('/cadastro', publicPartnerController.mostrarFormulario);
router.post(
  '/cadastro',
  uploadPetshopMediaMiddleware.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'fotos', maxCount: 6 },
  ]),
  persistPartnerPetshopUploads,
  ...validarParceiroCadastro,
  validarResultado,
  geoValidationMiddleware,
  rateLimitPartnerSignupMiddleware,
  publicPartnerController.enviarSolicitacao
);
router.get('/status/:id', publicPartnerController.apiStatus);

module.exports = router;
