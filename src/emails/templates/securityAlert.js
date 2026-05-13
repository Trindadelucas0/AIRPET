const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, absoluteUrl, linkFallbackRow, COLORS } = require('../components');

/**
 * Alerta genérico (ação no sistema, segurança, etc.).
 * @param {{ nome?: string, subject: string, headline: string, messagePlain?: string, message?: string, messageHtml?: string, ctaLink?: string, ctaTexto?: string, reasonLine?: string, preheader?: string, baseUrl?: string }} data
 */
function buildSecurityAlertEmail(data) {
  const baseUrl = data.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const nome = data.nome || 'Olá';
  const subject = data.subject || 'Alerta importante no AIRPET';
  const headline = data.headline || 'Alerta importante';
  const messagePlain = data.messagePlain != null ? data.messagePlain : data.message;
  const messageHtml = data.messageHtml != null ? data.messageHtml : `<span>${escapeHtml(messagePlain || '')}</span>`;
  const reasonLine = data.reasonLine || 'Você recebeu este e-mail por causa de uma ação ou evento na sua conta AIRPET.';

  const cta =
    data.ctaLink && data.ctaTexto
      ? { href: absoluteUrl(data.ctaLink, baseUrl), label: data.ctaTexto }
      : null;

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">${escapeHtml(nome)}${nome === 'Olá' ? '' : ','}</p>`;

  const bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">${messageHtml}</p>`;

  const secondary = cta ? linkFallbackRow(cta.href) : '';

  const preheader = data.preheader || headline;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: headline,
    greetingHtml,
    bodyHtml,
    primaryCta: cta,
    secondaryHtml: secondary,
    footerExtra: reasonLine,
    securityNoteHtml: `<strong>Dica de segurança:</strong> acesse sempre pelo site ou app oficiais. Desconfie de links que pedem senha fora do fluxo normal.`,
    baseUrl,
  });

  const textParts = [subject, '', nome, '', headline, messagePlain || '', ''];
  if (cta) textParts.push(cta.href, '');
  textParts.push(reasonLine);
  return { subject, html, text: textParts.join('\n') };
}

module.exports = { buildSecurityAlertEmail };
