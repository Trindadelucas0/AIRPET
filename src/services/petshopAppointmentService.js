const PetshopAppointment = require('../models/PetshopAppointment');
const notificacaoService = require('./notificacaoService');

const petshopAppointmentService = {
  async criarAgendamento({ petshop_id, service_id, usuario_id, pet_id, observacoes, data_agendada }) {
    const appointment = await PetshopAppointment.criar({
      petshop_id,
      service_id,
      usuario_id,
      pet_id,
      observacoes,
      data_agendada,
    });

    await notificacaoService.criar(
      usuario_id,
      'sistema',
      'Seu agendamento foi enviado ao petshop e está pendente de aprovação.',
      '/agenda'
    );

    return appointment;
  },

  async atualizarStatus(appointmentId, status, motivo_recusa = null) {
    const appointment = await PetshopAppointment.atualizarStatus(appointmentId, status, motivo_recusa);
    if (!appointment) return null;

    let mensagem = 'Seu agendamento foi atualizado.';
    if (status === 'aceito') mensagem = 'Seu agendamento foi aceito pelo petshop.';
    if (status === 'recusado') mensagem = 'Seu agendamento foi recusado pelo petshop.';

    await notificacaoService.criar(appointment.usuario_id, 'sistema', mensagem, '/agenda');
    return appointment;
  },
};

module.exports = petshopAppointmentService;
