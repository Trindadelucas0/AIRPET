const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, absoluteUrl, linkFallbackRow, COLORS } = require('../components');

function buildTagShippedEmail({ nome, tagCode, activationCode, baseUrl }) {
  const base = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const linkAtivar = absoluteUrl(`/tags/${encodeURIComponent(tagCode)}/ativar`, base);
  const subject = 'Sua tag AIRPET está a caminho';
  const preheader = 'Guarde o código da tag e o código de ativação até a entrega.';

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Olá, <strong>${escapeHtml(nome || 'tutor')}</strong></p>`;

  const bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Sua tag já foi separada e está a caminho. Quando chegar, você vai usar os dados abaixo na ativação.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border:1px solid ${COLORS.border};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;color:${COLORS.text};">
          <div style="margin-bottom:8px;"><span style="color:${COLORS.textMuted};">Código da tag</span><br/><strong>${escapeHtml(String(tagCode))}</strong></div>
          <div><span style="color:${COLORS.textMuted};">Código de ativação</span><br/><strong>${escapeHtml(String(activationCode))}</strong></div>
        </td>
      </tr>
    </table>`;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Tag a caminho',
    greetingHtml,
    bodyHtml,
    primaryCta: { href: linkAtivar, label: 'Abrir página de ativação' },
    secondaryHtml: linkFallbackRow(linkAtivar),
    footerExtra: `Você recebeu este e-mail porque comprou ou reservou uma tag AIRPET.`,
    securityNoteHtml: `<strong>Guarde os códigos em local seguro.</strong> Não compartilhe o código de ativação com desconhecidos.`,
    baseUrl: base,
  });

  const text = [subject, '', `Olá, ${nome || 'tutor'}`, '', `Tag: ${tagCode}`, `Ativação: ${activationCode}`, '', linkAtivar].join('\n');
  return { subject, html, text };
}

module.exports = { buildTagShippedEmail };
