const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { limiterAuth } = require('../middlewares/rateLimiter');
const { validarRegistro, validarLogin, validarResultado } = require('../middlewares/validator');

// Páginas de autenticação
router.get('/login', authController.mostrarLogin);
router.get('/registro', authController.mostrarRegistro);

// Processar registro com validação e rate limiting
router.post('/registro', limiterAuth, validarRegistro, validarResultado, authController.registrar);

// Processar login com validação e rate limiting
router.post('/login', limiterAuth, validarLogin, validarResultado, authController.login);

// Recuperação de senha
router.get('/esqueci-senha', authController.mostrarEsqueciSenha);
router.post('/esqueci-senha', limiterAuth, authController.esqueciSenha);
router.get('/redefinir-senha/:token', authController.mostrarRedefinirSenha);
router.post('/redefinir-senha/:token', authController.redefinirSenha);

// Encerrar sessão
router.get('/logout', authController.logout);

module.exports = router;
