const express = require('express');
const router = express.Router();

const publicPartnerController = require('../controllers/publicPartnerController');
const { uploadPetshopMediaMiddleware } = require('../middlewares/uploadPetshopMediaMiddleware');
const { rateLimitPartnerSignupMiddleware } = require('../middlewares/rateLimitPartnerSignupMiddleware');
const { geoValidationMiddleware } = require('../middlewares/geoValidationMiddleware');

router.get('/cadastro', publicPartnerController.mostrarFormulario);
router.post(
  '/cadastro',
  uploadPetshopMediaMiddleware.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'fotos', maxCount: 6 },
  ]),
  geoValidationMiddleware,
  rateLimitPartnerSignupMiddleware,
  publicPartnerController.enviarSolicitacao
);
router.get('/status/:id', publicPartnerController.apiStatus);

module.exports = router;
