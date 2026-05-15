/**
 * listaEsperaController.js — Wizard /lista-espera e API
 */

const crypto = require('crypto');
const ListaEspera = require('../models/ListaEspera');
const logger = require('../utils/logger');

function hashIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  const salt = process.env.VALIDACAO_IP_SALT || process.env.SESSION_SECRET || 'airpet-lista-espera';
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function exibirWizard(req, res) {
  return res.render('lista-espera/wizard', { titulo: 'Lista de espera' });
}

function exibirObrigado(req, res) {
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return res.render('lista-espera/obrigado', {
    titulo: 'Vaga garantida',
    shareUrl: baseUrl,
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

  const respostas = req.body.respostas && typeof req.body.respostas === 'object' ? req.body.respostas : {};
  if (Array.isArray(respostas.prioridades) && respostas.prioridades.length > 2) {
    return res.status(422).json({ error: 'Escolha só 2 prioridades.' });
  }

  try {
    await ListaEspera.upsertPorEmail({
      email,
      nome,
      telefone: req.body.telefone,
      cidade: req.body.cidade,
      estado: req.body.estado,
      origem: req.body.origem || ListaEspera.ORIGEM_PADRAO,
      respostas,
      wizard_completo: req.body.wizard_completo !== false,
      user_agent: req.get('user-agent') || req.body.user_agent || null,
      ip_hash: hashIp(req),
    });

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
