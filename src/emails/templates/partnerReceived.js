const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, COLORS } = require('../components');

function buildPartnerReceivedEmail({ empresaNome, responsavelNome, baseUrl }) {
  const base = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const subject = 'Recebemos sua solicitação de parceria no AIRPET';
  const preheader = 'Nossa equipe vai analisar os dados do seu petshop e responde por e-mail.';

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Olá, <strong>${escapeHtml(responsavelNome || 'time')}</strong></p>`;

  const bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Sua solicitação de parceria para <strong>${escapeHtml(empresaNome || 'seu petshop')}</strong> chegou com sucesso ao AIRPET.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Em breve você recebe outro e-mail com o resultado da análise.
    </p>`;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Solicitação recebida',
    greetingHtml,
    bodyHtml,
    primaryCta: null,
    footerExtra: `Você recebeu este e-mail porque enviou um formulário de parceria no site AIRPET (${base}).`,
    securityNoteHtml: `<strong>Segurança:</strong> o AIRPET não pede senha de banco nem PIX por este canal. Desconfie de mensagens suspeitas.`,
    baseUrl: base,
  });

  const text = [subject, '', `Olá, ${responsavelNome || 'time'}`, '', `Petshop: ${empresaNome || 'seu petshop'}`, 'Solicitação recebida. Aguarde análise.'].join('\n');
  return { subject, html, text };
}

module.exports = { buildPartnerReceivedEmail };
