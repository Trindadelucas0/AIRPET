const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, COLORS } = require('../components');

function buildPartnerRejectedEmail({ empresaNome, motivo, baseUrl }) {
  const base = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const subject = 'Atualização sobre sua parceria com o AIRPET';
  const preheader = 'Sua solicitação não foi aprovada neste momento.';

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Olá, <strong>${escapeHtml(empresaNome || 'parceiro')}</strong></p>`;

  let bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Após análise, sua solicitação de parceria não pôde ser aprovada neste momento.
    </p>`;
  if (motivo) {
    bodyHtml += `<p style="margin:0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};"><strong>Motivo informado:</strong> ${escapeHtml(motivo)}</p>`;
  }

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Sobre sua solicitação',
    greetingHtml,
    bodyHtml,
    primaryCta: null,
    footerExtra: `Você recebeu este e-mail porque enviou uma solicitação de parceria no AIRPET.`,
    securityNoteHtml: `<strong>Conta segura:</strong> este e-mail não contém links obrigatórios. Em caso de dúvida, use apenas os canais oficiais do AIRPET.`,
    baseUrl: base,
  });

  const text = [subject, '', `Olá, ${empresaNome || 'parceiro'}`, '', motivo ? `Motivo: ${motivo}` : ''].filter(Boolean).join('\n');
  return { subject, html, text };
}

module.exports = { buildPartnerRejectedEmail };
