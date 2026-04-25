const express = require('express');
const router = express.Router();

const mapaController = require('../controllers/mapaController');

// Página do mapa público
router.get('/', (req, res) => {
  res.render('mapa/index');
});

// API — buscar pins para exibir no mapa (todas as camadas públicas)
router.get('/api/pins', mapaController.buscarPins);

// API — buscar pins dos pets que o usuário segue (requer autenticação)
router.get('/api/pins/social', mapaController.buscarPinsSocial);

// SSE — stream de atualizações em tempo real para o mapa
router.get('/api/stream', mapaController.streamMapaSSE);

module.exports = router;
