const { COLORS, FONT_STACK } = require('./constants');

/**
 * Escapa texto/HTML inserido em templates para evitar XSS se dados vierem do banco.
 * URLs em atributos href também passam por escape de aspas.
 */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Garante URL absoluta para links em e-mail (clientes não resolvem caminhos relativos).
 */
function absoluteUrl(href, baseUrl) {
  const b = (baseUrl || '').replace(/\/$/, '');
  if (!href) return b || '#';
  if (/^https?:\/\//i.test(href)) return href;
  const path = href.startsWith('/') ? href : `/${href}`;
  return `${b}${path}`;
}

/**
 * Botão “bulletproof”: tabela + td com background (Outlook ignora border-radius em <a> às vezes).
 * Padding generoso = alvo tocável em mobile.
 */
function primaryButton({ href, label, bgColor = COLORS.primary }) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px 0;">
  <tr>
    <td align="left" bgcolor="${bgColor}" style="background-color:${bgColor};border-radius:10px;mso-padding-alt:14px 28px;">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;line-height:1.25;">
        ${safeLabel}
      </a>
    </td>
  </tr>
</table>`;
}

/** Bloco de aviso de segurança (borda suave, fundo neutro). */
function securityBox(innerHtml) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
  <tr>
    <td style="padding:14px 16px;border:1px solid ${COLORS.securityBorder};border-radius:10px;background-color:${COLORS.securityBg};font-family:${FONT_STACK};font-size:13px;line-height:1.55;color:${COLORS.textMuted};">
      ${innerHtml}
    </td>
  </tr>
</table>`;
}

/** Link completo em texto mono para quando o botão não abre no cliente de e-mail. */
function linkFallbackRow(url) {
  const u = escapeHtml(url);
  return `<p style="margin:16px 0 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLORS.textMuted};word-break:break-all;">
  Se o botão não funcionar, copie e cole este link no navegador:<br/>
  <span style="color:${COLORS.text};">${u}</span>
</p>`;
}

/** Mini-card do pet (nome + espécie); foto só se URL absoluta https. */
function petHighlightCard({ nomePet, especieLabel, fotoUrl }) {
  const nome = escapeHtml(nomePet || 'Seu pet');
  const esp = especieLabel ? escapeHtml(especieLabel) : '';
  const showImg = fotoUrl && /^https?:\/\//i.test(String(fotoUrl));
  const imgCell = showImg
    ? `<td width="56" valign="middle" style="padding-right:12px;">
         <img src="${escapeHtml(fotoUrl)}" alt="" width="56" height="56" style="display:block;border-radius:10px;width:56px;height:56px;object-fit:cover;border:1px solid ${COLORS.border};" />
       </td>`
    : `<td width="56" valign="middle" style="padding-right:12px;">
         <div style="width:56px;height:56px;border-radius:10px;background:${COLORS.primarySoft};border:1px solid ${COLORS.border};font-size:22px;line-height:54px;text-align:center;color:${COLORS.primary};">◇</div>
       </td>`;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
  <tr>
    <td style="padding:14px 16px;background:${COLORS.primarySoft};">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          ${imgCell}
          <td valign="middle" style="font-family:${FONT_STACK};">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.textMuted};">Seu pet no AIRPET</p>
            <p style="margin:4px 0 0 0;font-size:17px;font-weight:700;color:${COLORS.text};">${nome}</p>
            ${esp ? `<p style="margin:2px 0 0 0;font-size:14px;color:${COLORS.textMuted};">${esp}</p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

module.exports = {
  escapeHtml,
  absoluteUrl,
  primaryButton,
  securityBox,
  linkFallbackRow,
  petHighlightCard,
  COLORS,
  FONT_STACK,
};
