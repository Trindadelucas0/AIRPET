const express = require('express');
const router = express.Router();

const { estaAutenticado } = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chatController');
const { uploadChat } = require('../utils/upload');
const { persistSingle } = require('../middlewares/persistUploadMiddleware');
const { limiterChatPublico } = require('../middlewares/rateLimiter');
const { validarChatIniciar, validarChatEnviar, validarChatVisitante, validarResultado } = require('../middlewares/writeRouteValidators');

router.post('/publico/iniciar-ou-enviar', limiterChatPublico, ...validarChatVisitante, validarResultado, chatController.iniciarOuEnviarVisitante);
router.post('/publico/enviar', limiterChatPublico, ...validarChatVisitante, validarResultado, chatController.enviarMensagemVisitante);

router.get('/', estaAutenticado, chatController.listarConversas);
router.post('/iniciar', estaAutenticado, ...validarChatIniciar, validarResultado, chatController.iniciarConversa);
router.get('/novo/:pet_id', estaAutenticado, chatController.abrirOuIniciarPorPet);
router.post('/:conversaId/enviar', estaAutenticado, uploadChat.single('foto'), persistSingle('chat'), ...validarChatEnviar, validarResultado, chatController.enviarMensagem);
router.get('/:conversaId', estaAutenticado, chatController.mostrarConversa);

module.exports = router;
