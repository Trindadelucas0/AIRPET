const { buildSecurityAlertEmail } = require('./securityAlert');
const { escapeHtml } = require('../components');

/**
 * E-mail de tag escaneada — reutiliza o layout de alerta de segurança.
 */
function buildTagScannedEmail({ nome, petNome, cidade, linkPet, baseUrl }) {
  const petRaw = String(petNome || 'seu pet').replace(/[\r\n]/g, ' ').trim().slice(0, 120);
  const petSafe = escapeHtml(petRaw);
  const cidadeRaw = cidade ? String(cidade).replace(/[\r\n]/g, ' ').trim().slice(0, 80) : '';
  const cidadeSafe = cidadeRaw ? escapeHtml(cidadeRaw) : '';
  const cidadeTexto = cidadeSafe ? ` em ${cidadeSafe}` : '';

  const subject = `A tag de ${petRaw} foi escaneada`;
  const headline = 'Atividade na tag do seu pet';
  const messageHtml = `A tag de <strong>${petSafe}</strong> foi escaneada${cidadeTexto}. Abra o AIRPET para ver o contexto e, se precisar, falar com quem encontrou.`;

  const messagePlain = `A tag de ${petRaw} foi escaneada${cidadeRaw ? ` em ${cidadeRaw}` : ''}. Abra o AIRPET para ver o contexto.`;

  return buildSecurityAlertEmail({
    nome: nome || 'Olá',
    subject,
    headline,
    messageHtml,
    messagePlain,
    ctaLink: linkPet,
    ctaTexto: 'Ver detalhes do meu pet',
    reasonLine: `Você recebeu este e-mail porque a tag NFC do pet ${petRaw} foi lida por alguém.`,
    preheader: `A tag de ${petRaw} acabou de ser escaneada${cidadeRaw ? ` em ${cidadeRaw}` : ''}.`,
    baseUrl,
  });
}

module.exports = { buildTagScannedEmail };
