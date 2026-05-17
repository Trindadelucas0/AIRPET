/**
 * listaEsperaController.js — Wizard /lista-espera e API
 */

const crypto = require('crypto');
const ListaEspera = require('../models/ListaEspera');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

function hashIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  const salt = process.env.VALIDACAO_IP_SALT || process.env.SESSION_SECRET || 'airpet-lista-espera';
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function exibirWizard(req, res) {
  const ref = String(req.query.ref || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16);
  if (ref && req.session) {
    req.session.waitlistRef = ref;
  }
  return res.render('lista-espera/wizard', {
    titulo: 'Lista de espera',
    referralOrigem: ref || (req.session && req.session.waitlistRef) || '',
  });
}

async function exibirObrigado(req, res) {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const flash = req.session?.waitlistObrigado;
  if (req.session && req.session.waitlistObrigado) {
    delete req.session.waitlistObrigado;
  }
  if (!flash?.email) {
    return res.redirect(302, '/lista-espera');
  }

  let posicao = null;
  let totalFila = 0;
  let referralCode = '';
  try {
    [posicao, totalFila] = await Promise.all([
      ListaEspera.posicaoNaFila(flash.email),
      ListaEspera.contarWizardCompleto(),
    ]);
    const row = await ListaEspera.buscarPorEmail(flash.email);
    referralCode = row?.referral_code || '';
  } catch (e) {
    logger.error('LISTA_ESPERA', 'Erro ao montar página obrigado', e);
  }

  const referralUrl = referralCode ? `${String(base).replace(/\/$/, '')}/proteger-meu-pet?ref=${referralCode}` : `${String(base).replace(/\/$/, '')}/proteger-meu-pet`;
  const instagramUrl = (process.env.INSTAGRAM_URL || 'https://instagram.com').trim();

  return res.render('lista-espera/obrigado', {
    titulo: 'Você está na lista',
    shareUrl: base,
    nomeUsuario: flash.nome || '',
    posicaoNaFila: posicao,
    totalFila,
    referralUrl,
    instagramUrl,
  });
}

async function inscrever(req, res) {
  if (req.body && String(req.body.website || '').trim()) {
    return res.json({ success: true });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const nome = String(req.body?.nome || '').trim();

  if (!nome || !email) {
    return res.status(422).json({ error: 'Nome e e-mail são obrigatórios.' });
  }

  let respostas = req.body.respostas && typeof req.body.respostas === 'object' ? req.body.respostas : {};
  const refOrig = String(req.body?.referral_origem || '').trim().slice(0, 32);
  if (refOrig) {
    respostas = { ...respostas, referral_origem: refOrig };
  }
  if (Array.isArray(respostas.prioridades) && respostas.prioridades.length > 2) {
    return res.status(422).json({ error: 'Escolha só 2 prioridades.' });
  }

  const completo = req.body.wizard_completo !== false;

  try {
    await ListaEspera.upsertPorEmail({
      email,
      nome,
      telefone: req.body.telefone,
      cidade: req.body.cidade,
      estado: req.body.estado,
      origem: req.body.origem || ListaEspera.ORIGEM_PADRAO,
      respostas,
      wizard_completo: completo,
      user_agent: req.get('user-agent') || req.body.user_agent || null,
      ip_hash: hashIp(req),
    });

    if (completo && req.session) {
      req.session.waitlistObrigado = { email, nome, at: Date.now() };
      setImmediate(() => {
        emailService.enviarListaEsperaConfirmacao({ to: email, nome }).catch((err) => {
          logger.warn('LISTA_ESPERA', 'E-mail de confirmação não enviado', err?.message || err);
        });
      });
    }

    return res.json({ success: true });
  } catch (erro) {
    logger.error('LISTA_ESPERA', 'Erro ao inscrever', erro);
    return res.status(500).json({ error: 'Algo deu errado — tente de novo' });
  }
}

module.exports = {
  exibirWizard,
  exibirObrigado,
  inscrever,
};
