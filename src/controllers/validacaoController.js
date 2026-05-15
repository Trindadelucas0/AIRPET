/**
 * validacaoController.js — Landing /proteger-meu-pet e wizard de validação
 */

const crypto = require('crypto');
const ValidacaoInteresse = require('../models/ValidacaoInteresse');
const logger = require('../utils/logger');

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function ogImageUrl(req) {
  return `${baseUrl(req)}/images/landing/og.jpg`;
}

function hashIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  const salt = process.env.VALIDACAO_IP_SALT || process.env.SESSION_SECRET || 'airpet-validacao';
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function metaComum(req) {
  const canonical = `${baseUrl(req)}/proteger-meu-pet`;
  return {
    metaDescription:
      'Quando seu pet some, cada minuto pesa. O AIRPET conecta donos de pets a quem encontrou — entre na lista de espera.',
    ogTitle: 'Seu pet pode desaparecer em segundos | AIRPET',
    ogDescription:
      'Proteção e reencontro mais rápido para quem ama um pet. Lista de espera AIRPET — leva cerca de 2 minutos.',
    ogImage: ogImageUrl(req),
    ogUrl: canonical,
    canonicalUrl: canonical,
  };
}

function exibirLanding(req, res) {
  return res.render('validacao/proteger-meu-pet', {
    titulo: 'Proteger meu pet',
    ...metaComum(req),
  });
}

function exibirWizard(req, res) {
  return res.redirect(302, '/lista-espera');
}

async function inscrever(req, res) {
  if (req.body && String(req.body.website || '').trim()) {
    return res.json({ sucesso: true, mensagem: 'Recebemos seu interesse.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const origemRaw = String(req.body?.origem || ValidacaoInteresse.ORIGEM_PADRAO).trim();
  const origem = origemRaw.slice(0, 64) || ValidacaoInteresse.ORIGEM_PADRAO;
  const wizardCompleto = req.body.wizard_completo === true || req.body.wizard_completo === 'true';
  const respostas = req.body.respostas && typeof req.body.respostas === 'object' ? req.body.respostas : {};

  try {
    const existente = await ValidacaoInteresse.buscarPorEmail(email, origem);
    if (existente?.wizard_completo && wizardCompleto) {
      return res.json({
        sucesso: true,
        jaInscrito: true,
        mensagem: 'Você já está na lista. Avisaremos quando abrirmos as vagas.',
      });
    }

    const eraNovo = !existente;
    await ValidacaoInteresse.inscrever({
      email,
      origem,
      nome: req.body.nome,
      telefone: req.body.telefone,
      cidade: req.body.cidade,
      estado: req.body.estado,
      respostas,
      wizard_completo: wizardCompleto,
      user_agent: req.get('user-agent') || null,
      ip_hash: hashIp(req),
    });

    if (eraNovo) {
      return res.status(201).json({
        sucesso: true,
        mensagem: wizardCompleto
          ? 'Pronto! Você entrou na lista. Entraremos em contato quando abrirmos as vagas.'
          : 'Recebemos. Entraremos em contato quando abrirmos as vagas.',
      });
    }

    return res.json({
      sucesso: true,
      mensagem: wizardCompleto
        ? 'Atualizamos suas respostas. Obrigado por ajudar a validar o AIRPET.'
        : 'Recebemos. Entraremos em contato quando abrirmos as vagas.',
    });
  } catch (erro) {
    logger.error('VALIDACAO', 'Erro ao inscrever lead', erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Não foi possível concluir agora. Tente de novo em instantes.',
    });
  }
}

module.exports = {
  exibirLanding,
  exibirWizard,
  inscrever,
};
