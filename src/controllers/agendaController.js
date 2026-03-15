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

const AgendaPetshop = require('../models/AgendaPetshop');
const Pet = require('../models/Pet');
const Petshop = require('../models/Petshop');
const logger = require('../utils/logger');

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
    const { petshop_id, pet_id, servico, data } = req.body;

    if (!petshop_id || !servico || !data) {
      req.session.flash = { tipo: 'erro', mensagem: 'Preencha todos os campos obrigatórios do agendamento.' };
      return res.redirect('/agenda');
    }

    const agendamento = await AgendaPetshop.criar({
      petshop_id,
      usuario_id: usuarioId,
      pet_id: pet_id || null,
      servico,
      data,
    });

    logger.info('AgendaController', `Agendamento criado: ${agendamento.id} (serviço: ${servico})`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Agendamento criado com sucesso!' };
    return res.redirect('/agenda');
  } catch (erro) {
    logger.error('AgendaController', 'Erro ao criar agendamento', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao criar o agendamento. Tente novamente.' };
    return res.redirect('/agenda');
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

    const [agendamentos, pets, petshops] = await Promise.all([
      AgendaPetshop.buscarPorUsuario(usuarioId),
      Pet.buscarPorUsuario(usuarioId),
      Petshop.listarAtivos(),
    ]);

    return res.render('agenda/lista', {
      titulo: 'Meus Agendamentos - AIRPET',
      agendamentos,
      pets,
      petshops,
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

    const agendamento = await AgendaPetshop.buscarPorId(id);

    if (!agendamento) {
      req.session.flash = { tipo: 'erro', mensagem: 'Agendamento não encontrado.' };
      return res.redirect('/agenda');
    }

    if (agendamento.usuario_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para cancelar este agendamento.' };
      return res.redirect('/agenda');
    }

    if (agendamento.status === 'cancelado' || agendamento.status === 'concluido') {
      req.session.flash = { tipo: 'erro', mensagem: `Não é possível cancelar um agendamento ${agendamento.status}.` };
      return res.redirect('/agenda');
    }

    await AgendaPetshop.cancelar(id);

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

    const agendamento = await AgendaPetshop.buscarPorId(id);

    if (!agendamento) {
      req.session.flash = { tipo: 'erro', mensagem: 'Agendamento não encontrado.' };
      return res.redirect((process.env.ADMIN_PATH || '/admin') + '/dashboard');
    }

    if (agendamento.status !== 'agendado') {
      req.session.flash = { tipo: 'erro', mensagem: `Não é possível confirmar um agendamento com status "${agendamento.status}".` };
      return res.redirect((process.env.ADMIN_PATH || '/admin') + '/dashboard');
    }

    await AgendaPetshop.confirmar(id);

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
