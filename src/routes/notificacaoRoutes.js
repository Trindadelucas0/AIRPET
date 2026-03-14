const express = require('express');
const router = express.Router();

const notificacaoController = require('../controllers/notificacaoController');

router.get('/', notificacaoController.listar);

router.get('/api/count', notificacaoController.contarNaoLidas);

router.post('/:id/lida', notificacaoController.marcarLida);

router.post('/push/subscribe', notificacaoController.subscribe);

router.post('/push/unsubscribe', notificacaoController.unsubscribe);

module.exports = router;
