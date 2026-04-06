/**
 * API v1 — sync de perfil / lista seguindo / auth mobile (Bearer + refresh).
 */

const express = require('express');
const { validarResultado } = require('../middlewares/validator');
const { limiterAuth } = require('../middlewares/rateLimiter');
const { estaAutenticadoAPI } = require('../middlewares/authMiddleware');
const { authApiController, validarMobileLogin } = require('../controllers/authApiController');
const syncApiController = require('../controllers/syncApiController');

const router = express.Router();

router.post(
  '/auth/mobile-login',
  limiterAuth,
  validarMobileLogin,
  validarResultado,
  authApiController.mobileLogin
);

router.post('/auth/refresh', limiterAuth, authApiController.refresh);

router.post('/auth/mobile-logout', authApiController.mobileLogout);

router.get('/me', estaAutenticadoAPI, syncApiController.getMe);
router.patch('/me', estaAutenticadoAPI, syncApiController.patchMe);
router.get('/me/preferences', estaAutenticadoAPI, syncApiController.getPreferences);
router.get('/me/following', estaAutenticadoAPI, syncApiController.getFollowing);

module.exports = router;
