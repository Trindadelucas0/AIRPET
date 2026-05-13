const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, absoluteUrl, linkFallbackRow, COLORS } = require('../components');

function buildPartnerApprovedEmail({ empresaNome, baseUrl }) {
  const base = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const painelUrl = absoluteUrl('/petshop-panel/login', base);
  const subject = 'Parceria aprovada no AIRPET';
  const preheader = 'Seu petshop já pode acessar o painel do parceiro.';

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Parabéns, <strong>${escapeHtml(empresaNome || 'parceiro')}</strong></p>`;

  const bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Sua parceria com o AIRPET foi aprovada. A partir de agora você pode usar o painel para gerenciar sua presença na plataforma.
    </p>`;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Parceria aprovada',
    greetingHtml,
    bodyHtml,
    primaryCta: { href: painelUrl, label: 'Acessar painel do parceiro' },
    secondaryHtml: linkFallbackRow(painelUrl),
    footerExtra: `Você recebeu este e-mail porque a solicitação de parceria do petshop ${empresaNome || ''} foi aprovada.`,
    securityNoteHtml: `<strong>Se você não esperava este e-mail,</strong> ignore ou fale com o suporte — outra pessoa pode ter informado o endereço errado.`,
    baseUrl: base,
  });

  const text = [subject, '', `Parabéns, ${empresaNome || 'parceiro'}`, '', `Painel: ${painelUrl}`].join('\n');
  return { subject, html, text };
}

module.exports = { buildPartnerApprovedEmail };
