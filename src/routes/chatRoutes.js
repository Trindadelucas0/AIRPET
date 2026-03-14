const express = require('express');
const router = express.Router();

const { estaAutenticado } = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chatController');

router.get('/', estaAutenticado, chatController.listarConversas);
router.post('/iniciar', estaAutenticado, chatController.iniciarConversa);
router.get('/:conversaId', estaAutenticado, chatController.mostrarConversa);

module.exports = router;
