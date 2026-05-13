const path = require('path');
const fs = require('fs');
const { COLORS, MAX_WIDTH, FONT_STACK } = require('./constants');
const { escapeHtml, primaryButton, securityBox } = require('./components');

/**
 * Layout 100% em tabelas: Gmail/Outlook aplicam melhor estilos em <td> do que em <div> soltos.
 * Pré-header oculto: trecho no topo que clientes mostram na lista sem abrir o e-mail — reduz cara de spam.
 */
function logoImageSrc(baseUrl) {
  const logoPath = path.join(__dirname, '..', 'public', 'images', 'email-logo.png');
  if (!fs.existsSync(logoPath)) return null;
  const b = String(baseUrl || '').replace(/\/$/, '');
  return b ? `${b}/images/email-logo.png` : null;
}

function supportFooterHtml() {
  const e = (process.env.SUPPORT_EMAIL || '').trim();
  if (e) {
    const safe = escapeHtml(e);
    return `Dúvidas? <a href="mailto:${safe}" style="color:${COLORS.textMuted};text-decoration:underline;">${safe}</a>`;
  }
  return `Dúvidas? Responda a este e-mail — encaminhamos para o time AIRPET quando possível.`;
}

/**
 * @param {object} opts
 * @param {string} opts.preheader — resumo para lista de e-mails (escapado)
 * @param {string} opts.documentTitle — <title>
 * @param {string} opts.title — H1 principal
 * @param {string} [opts.greetingHtml] — saudação (HTML já seguro / controlado pelo template)
 * @param {string} opts.bodyHtml — miolo (HTML dos templates)
 * @param {{ href: string, label: string } | null} [opts.primaryCta]
 * @param {string} [opts.secondaryHtml] — ex.: fallback de link
 * @param {string} [opts.footerExtra] — “Você recebeu porque…”
 * @param {string} [opts.securityNoteHtml] — se preenchido, exibe caixa de segurança
 */
function buildTransactionalEmail(opts) {
  const {
    preheader = '',
    documentTitle = 'AIRPET',
    title,
    greetingHtml = '',
    bodyHtml,
    primaryCta = null,
    secondaryHtml = '',
    footerExtra = '',
    securityNoteHtml = '',
    baseUrl = '',
  } = opts;

  const safePre = escapeHtml(preheader);
  const safeTitle = escapeHtml(title);
  const logoSrc = logoImageSrc(baseUrl);
  const headerInner = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" width="120" height="" alt="AIRPET" style="display:block;max-width:120px;height:auto;border:0;" />`
    : `<span style="font-family:${FONT_STACK};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${COLORS.primary};">AIRPET</span>`;

  const ctaBlock =
    primaryCta && primaryCta.href && primaryCta.label
      ? primaryButton({ href: primaryCta.href, label: primaryCta.label })
      : '';

  const securityBlock = securityNoteHtml ? securityBox(securityNoteHtml) : '';

  const footerReason = footerExtra
    ? `<p style="margin:0 0 10px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLORS.textFooter};">${escapeHtml(footerExtra)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(documentTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.pageBg};">
  <!-- Pré-header: visível na prévia da caixa de entrada; oculto no corpo -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${COLORS.pageBg};">
    ${safePre}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.pageBg}" style="background-color:${COLORS.pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="${MAX_WIDTH}" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:${MAX_WIDTH}px;background-color:${COLORS.cardBg};border-radius:14px;border:1px solid ${COLORS.border};overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 16px 28px;border-bottom:1px solid ${COLORS.border};">
              ${headerInner}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 32px 28px;font-family:${FONT_STACK};">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.25;font-weight:700;color:${COLORS.text};">${safeTitle}</h1>
              ${greetingHtml}
              ${bodyHtml}
              ${ctaBlock}
              ${secondaryHtml}
              ${securityBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;font-family:${FONT_STACK};">
              <hr style="border:none;border-top:1px solid ${COLORS.border};margin:0 0 16px 0;" />
              ${footerReason}
              <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:${COLORS.textFooter};">${supportFooterHtml()}</p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:${COLORS.textFooter};">© ${new Date().getFullYear()} AIRPET. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { buildTransactionalEmail, supportFooterHtml, logoImageSrc };
