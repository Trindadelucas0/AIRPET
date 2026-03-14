const express = require('express');
const router = express.Router();

const petshopController = require('../controllers/petshopController');

// Listagem pública de petshops
router.get('/', petshopController.listar);

// Detalhes de um petshop específico
router.get('/:id', petshopController.mostrarDetalhes);

module.exports = router;
