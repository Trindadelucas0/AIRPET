const express = require('express');
const router = express.Router();

const { estaAutenticado } = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chatController');
const { uploadChat } = require('../utils/upload');
const { validarChatIniciar, validarChatEnviar, validarResultado } = require('../middlewares/writeRouteValidators');

router.get('/', estaAutenticado, chatController.listarConversas);
router.post('/iniciar', estaAutenticado, ...validarChatIniciar, validarResultado, chatController.iniciarConversa);
router.get('/novo/:pet_id', estaAutenticado, chatController.abrirOuIniciarPorPet);
router.post('/:conversaId/enviar', estaAutenticado, uploadChat.single('foto'), ...validarChatEnviar, validarResultado, chatController.enviarMensagem);
router.get('/:conversaId', estaAutenticado, chatController.mostrarConversa);

module.exports = router;
