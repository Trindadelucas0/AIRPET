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

// Rastreamento de funil via sendBeacon (sem auth obrigatória)
router.post('/funil', (req, res) => {
  try {
    const { acao, pet_id, ts } = req.body || {};
    if (acao && typeof acao === 'string' && acao.length <= 60) {
      const logger = require('../utils/logger');
      logger.info('FUNIL', `acao=${acao} pet=${pet_id||'-'} uid=${req.session?.usuario?.id||'anon'} ts=${ts||Date.now()}`);
    }
    res.status(204).end();
  } catch (_) {
    res.status(204).end();
  }
});

module.exports = router;
