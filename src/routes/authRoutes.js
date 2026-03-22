const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { limiterAuth } = require('../middlewares/rateLimiter');
const {
  validarRegistro,
  validarLogin,
  validarResultado,
  camposPermitidos,
  CAMPOS_REGISTRO,
  CAMPOS_LOGIN,
  validarEsqueciSenha,
  validarRedefinirSenha,
  CAMPOS_ESQUECI_SENHA,
  CAMPOS_REDEFINIR_SENHA,
} = require('../middlewares/validator');

// Páginas de autenticação
router.get('/login', authController.mostrarLogin);
router.get('/registro', authController.mostrarRegistro);

// Processar registro com validação e rate limiting
router.post('/registro', limiterAuth, camposPermitidos(CAMPOS_REGISTRO), validarRegistro, validarResultado, authController.registrar);

// Processar login com validação e rate limiting
router.post('/login', limiterAuth, camposPermitidos(CAMPOS_LOGIN), validarLogin, validarResultado, authController.login);

// Recuperação de senha
router.get('/esqueci-senha', authController.mostrarEsqueciSenha);
router.post(
  '/esqueci-senha',
  limiterAuth,
  camposPermitidos(CAMPOS_ESQUECI_SENHA),
  validarEsqueciSenha,
  validarResultado,
  authController.esqueciSenha
);
router.get('/redefinir-senha/:token', authController.mostrarRedefinirSenha);
router.post(
  '/redefinir-senha/:token',
  camposPermitidos(CAMPOS_REDEFINIR_SENHA),
  validarRedefinirSenha,
  validarResultado,
  authController.redefinirSenha
);

// Encerrar sessão
router.get('/logout', authController.logout);

module.exports = router;
