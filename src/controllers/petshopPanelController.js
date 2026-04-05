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
const logger = require('../utils/logger');

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
      return res.render('petshop-panel/dashboard', {
        titulo: 'Painel do Petshop',
        services,
        products,
        posts,
        appointments,
        profile,
        solicitacoesVinculo,
        solicitacao,
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

  async atualizarAgendamento(req, res) {
    try {
      await petshopAppointmentService.atualizarStatus(
        req.params.id,
        req.body.status,
        req.body.motivo_recusa || null
      );
      req.session.flash = { tipo: 'sucesso', mensagem: 'Agendamento atualizado.' };
      return res.redirect('/petshop-panel/dashboard');
    } catch (erro) {
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar agendamento.' };
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
