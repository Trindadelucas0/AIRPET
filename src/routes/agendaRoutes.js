const express = require('express');
const router = express.Router();

const agendaController = require('../controllers/agendaController');

// Listar agendamentos do usuário
router.get('/', agendaController.listar);

// Criar novo agendamento
router.post('/', agendaController.criar);

// Cancelar agendamento (tutor dono)
router.post('/:id/cancelar', agendaController.cancelar);

// Confirmar agendamento (admin only)
router.post('/:id/confirmar', agendaController.confirmar);

module.exports = router;
