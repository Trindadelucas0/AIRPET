/**
 * validacaoController.js — Landing /proteger-meu-pet e wizard de validação
 */

const crypto = require('crypto');
const ValidacaoInteresse = require('../models/ValidacaoInteresse');
const ListaEspera = require('../models/ListaEspera');
const logger = require('../utils/logger');

const landingStatsCache = { expires: 0, value: null };

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
      'AIRPET em validação: lista de espera e formulário curto pra tutores que topam ajudar a priorizar o que construir primeiro.',
    ogTitle: 'Lista de espera | AIRPET (validação)',
    ogDescription:
      'Formulário curto, sem cartão. Sorteio de AirTag: 30 por cidade, sem custo — data do sorteio avisamos pelo WhatsApp.',
    ogImage: ogImageUrl(req),
    ogUrl: canonical,
    canonicalUrl: canonical,
  };
}

async function carregarStatsLanding() {
  const now = Date.now();
  const ttl = Math.max(5000, parseInt(process.env.LANDING_STATS_TTL_MS || '60000', 10) || 60000);
  if (landingStatsCache.value && landingStatsCache.expires > now) {
    return landingStatsCache.value;
  }
  const ag = await ListaEspera.agregarValidacao();
  const perdeu = ag.perdeuPet || [];
  const countKey = (k) => perdeu.find((r) => r.k === k)?.c || 0;
  const totalResp = perdeu.reduce((s, r) => s + r.c, 0) || 1;
  const pctJaPerdeuOuQuase = Math.round(((countKey('sim') + countKey('quase')) / totalResp) * 100);
  const value = {
    totalInscritos: ag.total ?? 0,
    wizardCompletoCount: ag.wizardCompleto ?? 0,
    pctJaPerdeuOuQuase: Number.isFinite(pctJaPerdeuOuQuase) ? pctJaPerdeuOuQuase : 0,
    topCidades: (ag.topCidades || []).slice(0, 5),
  };
  landingStatsCache.value = value;
  landingStatsCache.expires = now + ttl;
  return value;
}

async function exibirLanding(req, res) {
  const useLegacy =
    process.env.FEATURE_LANDING_V2 === '0' || String(process.env.FEATURE_LANDING_V2 || '').toLowerCase() === 'false';

  if (useLegacy) {
    return res.render('validacao/proteger-meu-pet-legacy', {
      titulo: 'Proteger meu pet',
      ...metaComum(req),
    });
  }

  const bu = baseUrl(req);
  const variant = String(res.locals.lpVariant || 'A').toUpperCase();
  const headlines =
    variant === 'B'
      ? {
          headlineH1: 'Pet someu? A gente quer ouvir o que você faria no primeiro minuto.',
          headlineSub:
            'Conta pra gente o que você faria no primeiro minuto — e entra no sorteio de AirTag: 30 por cidade, sem pagar nada; a data do sorteio avisamos no WhatsApp.',
        }
      : {
          headlineH1: 'Se o seu sumir, você merece uma linha direta com quem achou.',
          headlineSub:
            'O AIRPET ainda está nascendo: entra na lista, responde umas perguntas leves e participa do sorteio de AirTag — 30 tutores por cidade pra testar com a gente, sem custo. A data do sorteio mandamos no WhatsApp.',
        };

  let stats = {
    totalInscritos: 0,
    wizardCompletoCount: 0,
    pctJaPerdeuOuQuase: 0,
    topCidades: [],
  };
  try {
    stats = await carregarStatsLanding();
  } catch (e) {
    logger.error('VALIDACAO', 'Erro ao carregar stats da landing', e);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AIRPET',
    url: bu,
    description:
      'AIRPET — lista de espera pra tutores, sorteio de AirTag (30 por cidade) e foco no reencontro de pets.',
  };

  return res.render('validacao/proteger-meu-pet', {
    titulo: 'Proteger meu pet',
    metaDescription:
      'Lista de espera AIRPET: tutores que querem ajudar a moldar o reencontro de pets, sorteio de AirTag (30 por cidade) e aviso pelo WhatsApp.',
    ogTitle: 'Lista de espera | AIRPET — validação com tutores',
    ogDescription:
      'Formulário leve, sem cartão. Sorteio de AirTag: 30 por cidade, sem pagar nada — data do sorteio no WhatsApp.',
    ogImage: ogImageUrl(req),
    ogUrl: `${bu}/proteger-meu-pet`,
    canonicalUrl: `${bu}/proteger-meu-pet`,
    jsonLd,
    lpVariant: variant,
    ...headlines,
    ...stats,
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

    if (wizardCompleto && email) {
      setImmediate(() => {
        try {
          const emailService = require('../services/emailService');
          emailService.enviarListaEsperaConfirmacao({ to: email, nome: req.body.nome }).catch(() => {});
        } catch (_) {
          /* ignore */
        }
      });
    }

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
