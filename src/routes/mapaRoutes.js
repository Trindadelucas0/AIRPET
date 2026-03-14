const express = require('express');
const router = express.Router();

const mapaController = require('../controllers/mapaController');

// Página do mapa público
router.get('/', (req, res) => {
  res.render('mapa/index');
});

// API — buscar pins para exibir no mapa
router.get('/api/pins', mapaController.buscarPins);

module.exports = router;
