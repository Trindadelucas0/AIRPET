const express = require('express');
const router = express.Router();

const agendaController = require('../controllers/agendaController');
const { validarAgendaCriar, validarAgendaSemBody, validarResultado } = require('../middlewares/writeRouteValidators');

// Listar agendamentos do usuário
router.get('/', agendaController.listar);

// Criar novo agendamento
router.post('/', ...validarAgendaCriar, validarResultado, agendaController.criar);

// Cancelar agendamento (tutor dono)
router.post('/:id/cancelar', ...validarAgendaSemBody, validarResultado, agendaController.cancelar);

// Confirmar agendamento (admin only)
router.post('/:id/confirmar', ...validarAgendaSemBody, validarResultado, agendaController.confirmar);

module.exports = router;
