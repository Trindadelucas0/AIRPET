const PetshopAppointment = require('../models/PetshopAppointment');
const PetshopAccount = require('../models/PetshopAccount');
const PetshopService = require('../models/PetshopService');
const petshopDisponibilidadeService = require('./petshopDisponibilidadeService');
const notificacaoService = require('./notificacaoService');

const petshopAppointmentService = {
  async criarAgendamento({
    petshop_id,
    service_id,
    usuario_id,
    pet_id,
    observacoes,
    data_agendada,
    origem = 'tutor',
    prazoHoras = 6,
  }) {
    if (origem === 'tutor' && service_id && data_agendada) {
      const servicos = await PetshopService.listarAtivos(petshop_id);
      const servico = (servicos || []).find((s) => Number(s.id) === Number(service_id));
      if (!servico) {
        throw new Error('Serviço indisponível para este petshop.');
      }
      const dia = new Date(data_agendada).toISOString().slice(0, 10);
      const disponibilidade = await petshopDisponibilidadeService.listarSlotsDisponiveis({
        petshopId: petshop_id,
        serviceId: service_id,
        dia,
        duracaoMinutos: servico.duracao_minutos || 30,
      });
      const existeSlot = (disponibilidade.slots || []).some((slot) => {
        const i = new Date(slot.inicio).getTime();
        const alvo = new Date(data_agendada).getTime();
        return i === alvo;
      });
      if (!existeSlot) {
        throw new Error('Este horário não está mais disponível.');
      }
    }

    const expiresAt = new Date(Date.now() + (Math.max(Number(prazoHoras) || 6, 1) * 60 * 60 * 1000));
    const appointment = await PetshopAppointment.criarComPrazo({
      petshop_id,
      service_id,
      usuario_id,
      pet_id,
      observacoes,
      data_agendada,
      status: 'pendente',
      expires_at: expiresAt,
    });

    if (origem === 'tutor') {
      await notificacaoService.criar(
        usuario_id,
        'sistema',
        'Solicitação enviada. O petshop vai confirmar em breve.',
        '/agenda'
      );
    }

    const account = await PetshopAccount.buscarPorPetshopId(petshop_id);
    if (account && account.usuario_id) {
      const msg = origem === 'tutor'
        ? 'Você recebeu uma nova solicitação de agendamento.'
        : 'Um novo agendamento foi criado no seu painel.';
      await notificacaoService.criar(account.usuario_id, 'sistema', msg, '/petshop-panel/agenda');
    }

    return appointment;
  },

  async atualizarStatus(appointmentId, status, motivo_recusa = null) {
    const appointment = await PetshopAppointment.atualizarStatus(appointmentId, status, motivo_recusa);
    if (!appointment) return null;

    let mensagem = 'Seu agendamento foi atualizado.';
    if (status === 'aceito') mensagem = 'Seu agendamento foi confirmado pelo petshop.';
    if (status === 'recusado') mensagem = 'Seu agendamento foi recusado pelo petshop.';
    if (status === 'expirado') mensagem = 'Sua solicitação expirou por falta de confirmação do petshop.';
    if (status === 'cancelado') mensagem = 'Seu agendamento foi cancelado.';

    await notificacaoService.criar(appointment.usuario_id, 'sistema', mensagem, '/agenda');
    return appointment;
  },

  async cancelarPorTutor(appointmentId, usuarioId) {
    const appointment = await PetshopAppointment.cancelarPorUsuario(appointmentId, usuarioId);
    if (!appointment) return null;
    const account = await PetshopAccount.buscarPorPetshopId(appointment.petshop_id);
    if (account && account.usuario_id) {
      await notificacaoService.criar(
        account.usuario_id,
        'sistema',
        'Um tutor cancelou um agendamento pendente/confirmado.',
        '/petshop-panel/agenda'
      );
    }
    return appointment;
  },

  async expirarPendentes(prazoHoras = 6) {
    const pendentes = await PetshopAppointment.listarPendentesComExpiracao(500);
    const limiteMs = Math.max(Number(prazoHoras) || 6, 1) * 60 * 60 * 1000;
    const agora = Date.now();
    let total = 0;

    for (const item of pendentes) {
      const criado = item.data_criacao ? new Date(item.data_criacao).getTime() : null;
      if (!criado) continue;
      if ((agora - criado) < limiteMs) continue;
      const expirado = await PetshopAppointment.marcarExpirado(item.id);
      if (!expirado) continue;
      total += 1;
      await notificacaoService.criar(
        expirado.usuario_id,
        'sistema',
        'Sua solicitação de agendamento expirou por falta de resposta.',
        '/agenda'
      );
    }

    return total;
  },
};

module.exports = petshopAppointmentService;
