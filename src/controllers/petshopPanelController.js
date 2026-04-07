const bcrypt = require('bcrypt');
const PetshopAccount = require('../models/PetshopAccount');
const Usuario = require('../models/Usuario');
const PetshopService = require('../models/PetshopService');
const PetshopPost = require('../models/PetshopPost');
const PetshopProduct = require('../models/PetshopProduct');
const PetshopAppointment = require('../models/PetshopAppointment');
const PetshopProfile = require('../models/PetshopProfile');
const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const PetPetshopLinkRequest = require('../models/PetPetshopLinkRequest');
const petshopPublishingService = require('../services/petshopPublishingService');
const { multerPublicUrl } = require('../middlewares/persistUploadMiddleware');
const petshopScheduleService = require('../services/petshopScheduleService');
const petshopAppointmentService = require('../services/petshopAppointmentService');
const petshopAgendaResumoService = require('../services/petshopAgendaResumoService');
const logger = require('../utils/logger');

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(input) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input || ''))) {
    return new Date();
  }
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function dayRange(date) {
  const inicio = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const fim = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return { inicio, fim };
}

const petshopPanelController = {
  mostrarLogin(req, res) {
    if (req.session && req.session.petshopAccount) return res.redirect('/petshop-panel/dashboard');
    return res.render('petshop-panel/login', { titulo: 'Login do Parceiro' });
  },

  async login(req, res) {
    try {
      const { email, senha } = req.body || {};
      const account = await PetshopAccount.buscarPorEmail((email || '').trim().toLowerCase());
      if (!account) {
        req.session.flash = { tipo: 'erro', mensagem: 'Credenciais inválidas.' };
        return res.redirect('/petshop-panel/auth/login');
      }

      const ok = await bcrypt.compare(senha || '', account.password_hash);
      if (!ok) {
        req.session.flash = { tipo: 'erro', mensagem: 'Credenciais inválidas.' };
        return res.redirect('/petshop-panel/auth/login');
      }

      req.session.petshopAccount = {
        id: account.id,
        petshop_id: account.petshop_id,
        email: account.email,
        status: account.status,
      };

      // Auto-vinculação para contas antigas sem usuario_id (parceiros já aprovados)
      let usuario = null;
      if (account.usuario_id) {
        usuario = await Usuario.buscarPorId(account.usuario_id);
      } else if (account.status === 'ativo') {
        usuario = await Usuario.buscarPorEmail(account.email);
        if (!usuario) {
          usuario = await Usuario.criar({
            nome: 'Parceiro',
            email: account.email,
            senha_hash: account.password_hash,
            telefone: null,
            role: 'tutor',
          });
        }
        await PetshopAccount.atualizarUsuarioId(account.id, usuario.id);
      }

      if (usuario && !usuario.bloqueado) {
        const { senha_hash: _, ...usuarioSemSenha } = usuario;
        req.session.usuario = {
          id: usuarioSemSenha.id,
          nome: usuarioSemSenha.nome,
          email: usuarioSemSenha.email,
          role: usuarioSemSenha.role || 'tutor',
          cor_perfil: usuarioSemSenha.cor_perfil || '#ec5a1c',
          foto_perfil: usuarioSemSenha.foto_perfil,
        };
      }

      await PetshopAccount.registrarLogin(account.id);
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro no login do parceiro', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao entrar no painel.' };
      return res.redirect('/petshop-panel/auth/login');
    }
  },

  logout(req, res) {
    req.session.petshopAccount = null;
    return res.redirect('/petshop-panel/auth/login');
  },

  async dashboard(req, res) {
    try {
      const petshopId = req.petshopAccount.petshop_id;
      const [services, products, posts, appointments, profile, solicitacoesVinculo] = await Promise.all([
        PetshopService.listarAtivos(petshopId),
        PetshopProduct.listarAtivosPorPetshop(petshopId),
        PetshopPost.listarPublicosPorPetshop(petshopId),
        PetshopAppointment.listarPorPetshop(petshopId),
        PetshopProfile.buscarPorPetshopId(petshopId),
        PetPetshopLinkRequest.listarPendentesPorPetshop(petshopId, 100),
      ]);
      const solicitacao = await PetshopPartnerRequest.buscarPorPetshopId(petshopId);
      const [{ agendaDiasResumo }, { agendaResumo }] = await Promise.all([
        petshopAgendaResumoService.gerarResumoMensal(petshopId, new Date()),
        petshopAgendaResumoService.gerarResumoHoje(petshopId, new Date()),
      ]);

      return res.render('petshop-panel/dashboard', {
        titulo: 'Painel do Petshop',
        services,
        products,
        posts,
        appointments,
        appointmentsPreview: (appointments || []).slice(0, 5),
        profile,
        solicitacoesVinculo,
        solicitacao,
        agendaResumo,
        agendaDiasResumo,
        accountStatus: req.petshopAccount.status,
      });
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro no dashboard do parceiro', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar dashboard do parceiro.' };
      return res.redirect('/petshop-panel/auth/login');
    }
  },

  async criarPost(req, res) {
    try {
      const foto = multerPublicUrl(req.file, 'petshops');
      await petshopPublishingService.criarPost(
        req.petshopAccount.petshop_id,
        req.petshopAccount.id,
        { ...req.body, foto_url: foto }
      );
      req.session.flash = { tipo: 'sucesso', mensagem: 'Postagem criada com sucesso.' };
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      req.session.flash = { tipo: 'erro', mensagem: erro.message || 'Erro ao criar postagem.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async criarServico(req, res) {
    try {
      await petshopScheduleService.salvarServico(req.petshopAccount.petshop_id, req.body || {});
      req.session.flash = { tipo: 'sucesso', mensagem: 'Serviço salvo com sucesso.' };
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar serviço.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async criarAgendamento(req, res) {
    try {
      await petshopAppointmentService.criarAgendamento({
        ...req.body,
        petshop_id: req.petshopAccount.petshop_id,
      });
      req.session.flash = { tipo: 'sucesso', mensagem: 'Agendamento criado.' };
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao criar agendamento.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async mostrarAgenda(req, res) {
    try {
      const petshopId = req.petshopAccount.petshop_id;
      const dataSelecionada = parseDateKey(req.query?.dia);
      const dia = formatDateKey(dataSelecionada);
      const { inicio, fim } = dayRange(dataSelecionada);
      const appointments = await PetshopAppointment.listarPorPetshopNoDia(petshopId, inicio, fim);

      return res.render('petshop-panel/agenda', {
        titulo: 'Agenda do Petshop',
        diaSelecionado: dia,
        dataSelecionada,
        appointments,
      });
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro ao carregar agenda do parceiro', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar agenda.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async mostrarConfiguracaoAgenda(req, res) {
    try {
      const petshopId = req.petshopAccount.petshop_id;
      const regras = await petshopScheduleService.listarRegrasSemanais(petshopId);
      const regrasMap = (regras || []).reduce((acc, regra) => {
        acc[String(regra.dia_semana)] = regra;
        return acc;
      }, {});

      return res.render('petshop-panel/agenda-config', {
        titulo: 'Horários de Atendimento',
        regrasMap,
      });
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro ao carregar configuração da agenda', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar horários.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async salvarConfiguracaoAgenda(req, res) {
    try {
      const petshopId = req.petshopAccount.petshop_id;
      const operacoes = [];

      for (let dia = 0; dia <= 6; dia += 1) {
        const ativo = Boolean(req.body[`dia_${dia}_ativo`]);
        const abre = String(req.body[`dia_${dia}_abre`] || '').trim() || '08:00';
        const fecha = String(req.body[`dia_${dia}_fecha`] || '').trim() || '18:00';
        const intervaloInicio = String(req.body[`dia_${dia}_intervalo_inicio`] || '').trim() || null;
        const intervaloFim = String(req.body[`dia_${dia}_intervalo_fim`] || '').trim() || null;

        if (!ativo) {
          operacoes.push(petshopScheduleService.desativarRegraSemanal(petshopId, dia));
          continue;
        }

        operacoes.push(
          petshopScheduleService.salvarRegraSemanal(petshopId, {
            dia_semana: dia,
            abre,
            fecha,
            intervalo_inicio: intervaloInicio,
            intervalo_fim: intervaloFim,
            ativo: true,
          })
        );
      }

      await Promise.all(operacoes);
      req.session.flash = { tipo: 'sucesso', mensagem: 'Horários de atendimento atualizados.' };
      return res.redirect('/petshop-panel/agenda/config');
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro ao salvar configuração da agenda', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar horários.' };
      return res.redirect('/petshop-panel/agenda/config');
    }
  },

  async atualizarAgendamento(req, res) {
    try {
      await petshopAppointmentService.atualizarStatus(
        req.params.id,
        req.body.status,
        req.body.motivo_recusa || null
      );
      req.session.flash = { tipo: 'sucesso', mensagem: 'Agendamento atualizado.' };
      const referer = req.get('referer') || '';
      if (referer.includes('/petshop-panel/agenda')) {
        return res.redirect(referer);
      }
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar agendamento.' };
      const referer = req.get('referer') || '';
      if (referer.includes('/petshop-panel/agenda')) {
        return res.redirect(referer);
      }
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async salvarPerfil(req, res) {
    try {
      await PetshopProfile.upsert(req.petshopAccount.petshop_id, req.body || {});
      req.session.flash = { tipo: 'sucesso', mensagem: 'Perfil público atualizado.' };
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar perfil.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async aprovarSolicitacaoVinculo(req, res) {
    try {
      const petshopId = req.petshopAccount.petshop_id;
      const requestId = parseInt(req.params.id, 10);
      if (!requestId) {
        req.session.flash = { tipo: 'erro', mensagem: 'Solicitação inválida.' };
        return res.redirect('/petshop-panel/dashboard');
      }
      const aprovado = await PetPetshopLinkRequest.aprovarComVinculo({
        requestId,
        petshop_id: petshopId,
        reviewed_by_petshop_account_id: req.petshopAccount.id,
      });
      if (!aprovado) {
        req.session.flash = { tipo: 'erro', mensagem: 'Solicitação não encontrada ou já tratada.' };
        return res.redirect('/petshop-panel/dashboard');
      }
      req.session.flash = { tipo: 'sucesso', mensagem: 'Solicitação aprovada e vínculo ativado.' };
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro ao aprovar solicitação de vínculo', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao aprovar solicitação.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async recusarSolicitacaoVinculo(req, res) {
    try {
      const petshopId = req.petshopAccount.petshop_id;
      const requestId = parseInt(req.params.id, 10);
      if (!requestId) {
        req.session.flash = { tipo: 'erro', mensagem: 'Solicitação inválida.' };
        return res.redirect('/petshop-panel/dashboard');
      }
      const recusada = await PetPetshopLinkRequest.marcarRecusada({
        requestId,
        petshop_id: petshopId,
        reviewed_by_petshop_account_id: req.petshopAccount.id,
      });
      if (!recusada) {
        req.session.flash = { tipo: 'erro', mensagem: 'Solicitação não encontrada ou já tratada.' };
        return res.redirect('/petshop-panel/dashboard');
      }
      req.session.flash = { tipo: 'sucesso', mensagem: 'Solicitação recusada.' };
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro ao recusar solicitação de vínculo', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao recusar solicitação.' };
      return res.redirect('/petshop-panel/dashboard');
    }
  },

  async listarSolicitacoesVinculo(req, res) {
    try {
      const petshopId = req.petshopAccount.petshop_id;
      const lista = await PetPetshopLinkRequest.listarPendentesPorPetshop(petshopId, 200);
      return res.json({ sucesso: true, solicitacoes: lista });
    } catch (erro) {
      logger.error('PetshopPanelController', 'Erro ao listar solicitações de vínculo', erro);
      return res.status(500).json({ sucesso: false, solicitacoes: [] });
    }
  },
};

module.exports = petshopPanelController;
