const bcrypt = require('bcrypt');
const PetshopAccount = require('../models/PetshopAccount');
const PetshopService = require('../models/PetshopService');
const PetshopPost = require('../models/PetshopPost');
const PetshopProduct = require('../models/PetshopProduct');
const PetshopAppointment = require('../models/PetshopAppointment');
const PetshopProfile = require('../models/PetshopProfile');
const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const petshopPublishingService = require('../services/petshopPublishingService');
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
      };
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
      const [services, products, posts, appointments, profile] = await Promise.all([
        PetshopService.listarAtivos(petshopId),
        PetshopProduct.listarAtivosPorPetshop(petshopId),
        PetshopPost.listarPublicosPorPetshop(petshopId),
        PetshopAppointment.listarPorPetshop(petshopId),
        PetshopProfile.buscarPorPetshopId(petshopId),
      ]);
      const solicitacao = await PetshopPartnerRequest.buscarPorPetshopId(petshopId);
      return res.render('petshop-panel/dashboard', {
        titulo: 'Painel do Petshop',
        services,
        products,
        posts,
        appointments,
        profile,
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
      const foto = req.file ? `/images/petshops/${req.file.filename}` : null;
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
};

module.exports = petshopPanelController;
