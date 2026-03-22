const express = require('express');
const router = express.Router();

const notificacaoController = require('../controllers/notificacaoController');
const {
  validarNotifMarcarLida,
  validarNotifMarcarTodas,
  validarPushSubscribe,
  validarPushUnsubscribe,
  validarResultado,
} = require('../middlewares/writeRouteValidators');

router.get('/', notificacaoController.listar);

router.get('/api/count', notificacaoController.contarNaoLidas);

router.post('/marcar-todas-lidas', ...validarNotifMarcarTodas, validarResultado, notificacaoController.marcarTodasLidas);

router.post('/:id/lida', ...validarNotifMarcarLida, validarResultado, notificacaoController.marcarLida);

router.post('/push/subscribe', ...validarPushSubscribe, validarResultado, notificacaoController.subscribe);

router.post('/push/unsubscribe', ...validarPushUnsubscribe, validarResultado, notificacaoController.unsubscribe);

module.exports = router;
