/**
 * agendaController.js — Controller de Agendamentos do AIRPET
 *
 * Gerencia os agendamentos de serviços nos petshops parceiros.
 * Um tutor pode agendar serviços como:
 *   - Banho e tosa
 *   - Consulta veterinária
 *   - Vacinação
 *   - Check-up geral
 *
 * Cada agendamento vincula:
 *   - O petshop onde será realizado o serviço
 *   - O tutor que agendou
 *   - O pet que receberá o serviço
 *   - Data, horário e tipo de serviço
 *
 * Status possíveis de um agendamento:
 *   agendado → confirmado → concluído
 *                         → cancelado
 *
 * Rotas:
 *   POST /agenda      → criar (cria novo agendamento)
 *   GET  /agenda      → listar (lista agendamentos do usuário)
 */

const Pet = require('../models/Pet');
const Petshop = require('../models/Petshop');
const PetshopService = require('../models/PetshopService');
const PetshopAppointment = require('../models/PetshopAppointment');
const petshopAppointmentService = require('../services/petshopAppointmentService');
const petshopDisponibilidadeService = require('../services/petshopDisponibilidadeService');
const logger = require('../utils/logger');

function hojeDiaCivil() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * criar — Cria um novo agendamento de serviço em um petshop
 *
 * Rota: POST /agenda
 *
 * Fluxo:
 *   1. Extrai os dados do formulário (petshop, pet, serviço, data, horário)
 *   2. Valida os campos obrigatórios
 *   3. Cria o agendamento com status inicial 'agendado'
 *   4. Redireciona para a lista de agendamentos com mensagem de sucesso
 *
 * O agendamento é criado com status 'agendado' (padrão do banco).
 * O petshop pode confirmar ou o tutor pode cancelar posteriormente.
 *
 * @param {object} req - Requisição Express com body { petshop_id, pet_id, servico, data_agendamento, horario, observacoes }
 * @param {object} res - Resposta Express
 */
async function criar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const { petshop_id, pet_id, service_id, data, data_agendada, dia, observacoes } = req.body || {};
    const dataFinal = data_agendada || data;

    if (!petshop_id || !service_id || !pet_id || !dataFinal) {
      req.session.flash = { tipo: 'erro', mensagem: 'Preencha todos os campos obrigatórios do agendamento.' };
      return res.redirect('/agenda');
    }

    const agendamento = await petshopAppointmentService.criarAgendamento({
      petshop_id: Number(petshop_id),
      service_id: Number(service_id),
      usuario_id: usuarioId,
      pet_id: Number(pet_id),
      observacoes: observacoes || null,
      data_agendada: dataFinal,
      dia_selecionado: dia || null,
      origem: 'tutor',
    });

    logger.info('AgendaController', `Solicitação de agendamento criada: ${agendamento.id}`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Solicitação enviada para confirmação do petshop.' };
    return res.redirect('/agenda');
  } catch (erro) {
    logger.error('AgendaController', 'Erro ao criar agendamento', erro);
    req.session.flash = { tipo: 'erro', mensagem: erro.message || 'Erro ao criar o agendamento. Tente novamente.' };
    const query = new URLSearchParams();
    if (req.body?.petshop_id) query.set('petshop_id', req.body.petshop_id);
    if (req.body?.service_id) query.set('service_id', req.body.service_id);
    if (req.body?.pet_id) query.set('pet_id', req.body.pet_id);
    if (req.body?.dia) query.set('dia', req.body.dia);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return res.redirect(`/agenda${suffix}`);
  }
}

/**
 * listar — Lista todos os agendamentos do usuário logado
 *
 * Rota: GET /agenda
 * View: agenda/lista
 *
 * Busca todos os agendamentos do tutor logado,
 * ordenados por data (mais próximos primeiro).
 * Permite ao tutor ver seus agendamentos futuros e passados.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const petshopSelecionado = req.query.petshop_id ? Number(req.query.petshop_id) : null;
    const serviceSelecionado = req.query.service_id ? Number(req.query.service_id) : null;
    const petSelecionado = req.query.pet_id ? Number(req.query.pet_id) : null;
    const diaSelecionado = req.query.dia || hojeDiaCivil();

    const [agendamentos, pets, petshops] = await Promise.all([
      PetshopAppointment.listarPorUsuario(usuarioId),
      Pet.buscarPorUsuario(usuarioId),
      Petshop.listarAtivos(),
    ]);

    let servicosPorPetshop = {};
    await Promise.all(
      (petshops || []).map(async (ps) => {
        servicosPorPetshop[ps.id] = await PetshopService.listarAtivos(ps.id);
      })
    );

    let slotsDisponiveis = [];
    if (petshopSelecionado && serviceSelecionado && diaSelecionado) {
      const servico = (servicosPorPetshop[petshopSelecionado] || []).find((s) => s.id === serviceSelecionado);
      const disponibilidade = await petshopDisponibilidadeService.listarSlotsDisponiveis({
        petshopId: petshopSelecionado,
        serviceId: serviceSelecionado,
        dia: diaSelecionado,
        duracaoMinutos: servico && servico.duracao_minutos ? servico.duracao_minutos : 30,
      });
      slotsDisponiveis = disponibilidade.slots || [];
    }

    return res.render('agenda/lista', {
      titulo: 'Meus Agendamentos - AIRPET',
      agendamentos,
      pets,
      petshops,
      servicosPorPetshop,
      slotsDisponiveis,
      petshopSelecionado,
      serviceSelecionado,
      petSelecionado,
      diaSelecionado,
    });
  } catch (erro) {
    logger.error('AgendaController', 'Erro ao listar agendamentos', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar seus agendamentos.' };
    return res.redirect('/');
  }
}

/**
 * cancelar — Cancela um agendamento existente
 *
 * Rota: POST /agenda/:id/cancelar
 *
 * Apenas o tutor dono do agendamento pode cancelar.
 * Agendamentos já concluídos ou cancelados não podem ser cancelados novamente.
 */
async function cancelar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const { id } = req.params;

    const agendamento = await PetshopAppointment.buscarPorIdDoUsuario(id, usuarioId);

    if (!agendamento) {
      req.session.flash = { tipo: 'erro', mensagem: 'Agendamento não encontrado.' };
      return res.redirect('/agenda');
    }

    if (!['pendente', 'aceito'].includes(agendamento.status)) {
      req.session.flash = { tipo: 'erro', mensagem: `Não é possível cancelar um agendamento ${agendamento.status}.` };
      return res.redirect('/agenda');
    }

    await petshopAppointmentService.cancelarPorTutor(id, usuarioId);

    logger.info('AgendaController', `Agendamento cancelado: ${id} pelo usuário ${usuarioId}`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Agendamento cancelado com sucesso.' };
    return res.redirect('/agenda');
  } catch (erro) {
    logger.error('AgendaController', 'Erro ao cancelar agendamento', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao cancelar o agendamento. Tente novamente.' };
    return res.redirect('/agenda');
  }
}

/**
 * confirmar — Confirma um agendamento (acesso restrito a admin)
 *
 * Rota: POST /agenda/:id/confirmar
 *
 * Apenas administradores podem confirmar agendamentos.
 * Somente agendamentos com status 'agendado' podem ser confirmados.
 */
async function confirmar(req, res) {
  try {
    const { id } = req.params;

    if (!req.session.admin) {
      req.session.flash = { tipo: 'erro', mensagem: 'Apenas administradores podem confirmar agendamentos.' };
      return res.redirect('/agenda');
    }

    const agendamento = await PetshopAppointment.buscarPorId(id);

    if (!agendamento) {
      req.session.flash = { tipo: 'erro', mensagem: 'Agendamento não encontrado.' };
      return res.redirect((process.env.ADMIN_PATH || '/admin') + '/dashboard');
    }

    if (agendamento.status !== 'pendente') {
      req.session.flash = { tipo: 'erro', mensagem: `Não é possível confirmar um agendamento com status "${agendamento.status}".` };
      return res.redirect((process.env.ADMIN_PATH || '/admin') + '/dashboard');
    }

    await petshopAppointmentService.atualizarStatus(id, 'aceito');

    logger.info('AgendaController', `Agendamento confirmado: ${id} pelo admin`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Agendamento confirmado com sucesso.' };
    return res.redirect((process.env.ADMIN_PATH || '/admin') + '/dashboard');
  } catch (erro) {
    logger.error('AgendaController', 'Erro ao confirmar agendamento', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao confirmar o agendamento. Tente novamente.' };
    return res.redirect((process.env.ADMIN_PATH || '/admin') + '/dashboard');
  }
}

module.exports = {
  criar,
  listar,
  cancelar,
  confirmar,
};
