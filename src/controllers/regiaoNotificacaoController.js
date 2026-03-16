/**
 * regiaoNotificacaoController.js — CRUD de regiões para notificação em massa
 *
 * Regiões salvas (nome, latitude, longitude, raio_km) reutilizáveis no envio por mapa.
 */

const RegiaoNotificacao = require('../models/RegiaoNotificacao');
const logger = require('../utils/logger');

const getAdminPath = () => process.env.ADMIN_PATH || '/admin';

async function listar(req, res) {
  try {
    const regioes = await RegiaoNotificacao.listar();
    return res.render('admin/regioes-notificacao', {
      titulo: 'Regiões - Notificação em massa',
      regioes,
    });
  } catch (erro) {
    logger.error('RegiaoNotificacaoController', 'Erro ao listar regiões', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar regiões.' };
    return res.redirect(getAdminPath());
  }
}

async function criar(req, res) {
  try {
    const { nome, latitude, longitude, raio_km } = req.body;
    if (!nome || latitude === '' || longitude === '' || raio_km === '') {
      req.session.flash = { tipo: 'erro', mensagem: 'Nome, latitude, longitude e raio (km) são obrigatórios.' };
      return res.redirect(getAdminPath() + '/regioes-notificacao');
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const raio = parseFloat(raio_km);
    if (isNaN(lat) || isNaN(lng) || isNaN(raio) || raio <= 0) {
      req.session.flash = { tipo: 'erro', mensagem: 'Latitude, longitude e raio devem ser números válidos (raio > 0).' };
      return res.redirect(getAdminPath() + '/regioes-notificacao');
    }
    await RegiaoNotificacao.criar({ nome: nome.trim(), latitude: lat, longitude: lng, raio_km: raio });
    req.session.flash = { tipo: 'sucesso', mensagem: `Região "${nome.trim()}" criada com sucesso.` };
    return res.redirect(getAdminPath() + '/regioes-notificacao');
  } catch (erro) {
    logger.error('RegiaoNotificacaoController', 'Erro ao criar região', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao criar região. Tente novamente.' };
    return res.redirect(getAdminPath() + '/regioes-notificacao');
  }
}

async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.redirect(getAdminPath() + '/regioes-notificacao');
    const { nome, latitude, longitude, raio_km } = req.body;
    const existente = await RegiaoNotificacao.buscarPorId(id);
    if (!existente) {
      req.session.flash = { tipo: 'erro', mensagem: 'Região não encontrada.' };
      return res.redirect(getAdminPath() + '/regioes-notificacao');
    }
    const lat = latitude !== undefined && latitude !== '' ? parseFloat(latitude) : existente.latitude;
    const lng = longitude !== undefined && longitude !== '' ? parseFloat(longitude) : existente.longitude;
    const raio = raio_km !== undefined && raio_km !== '' ? parseFloat(raio_km) : existente.raio_km;
    if (isNaN(lat) || isNaN(lng) || isNaN(raio) || raio <= 0) {
      req.session.flash = { tipo: 'erro', mensagem: 'Latitude, longitude e raio devem ser números válidos (raio > 0).' };
      return res.redirect(getAdminPath() + '/regioes-notificacao');
    }
    await RegiaoNotificacao.atualizar(id, {
      nome: nome !== undefined ? nome.trim() : existente.nome,
      latitude: lat,
      longitude: lng,
      raio_km: raio,
    });
    req.session.flash = { tipo: 'sucesso', mensagem: 'Região atualizada com sucesso.' };
    return res.redirect(getAdminPath() + '/regioes-notificacao');
  } catch (erro) {
    logger.error('RegiaoNotificacaoController', 'Erro ao atualizar região', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar região. Tente novamente.' };
    return res.redirect(getAdminPath() + '/regioes-notificacao');
  }
}

async function excluir(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.redirect(getAdminPath() + '/regioes-notificacao');
    const existente = await RegiaoNotificacao.buscarPorId(id);
    if (!existente) {
      req.session.flash = { tipo: 'erro', mensagem: 'Região não encontrada.' };
      return res.redirect(getAdminPath() + '/regioes-notificacao');
    }
    await RegiaoNotificacao.deletar(id);
    req.session.flash = { tipo: 'sucesso', mensagem: `Região "${existente.nome}" removida.` };
    return res.redirect(getAdminPath() + '/regioes-notificacao');
  } catch (erro) {
    logger.error('RegiaoNotificacaoController', 'Erro ao excluir região', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao remover região. Tente novamente.' };
    return res.redirect(getAdminPath() + '/regioes-notificacao');
  }
}

module.exports = {
  listar,
  criar,
  atualizar,
  excluir,
};
