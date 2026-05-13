const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, absoluteUrl, linkFallbackRow, COLORS } = require('../components');
const { PASSWORD_RESET_TTL_MINUTES } = require('../authTiming');

/**
 * @param {{ nome?: string, linkRedefinir: string, minutosValidade?: number, baseUrl?: string }} data
 */
function buildPasswordResetEmail(data) {
  const baseUrl = data.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const nome = data.nome || 'tutor';
  const minutos = Number(data.minutosValidade) > 0 ? Number(data.minutosValidade) : PASSWORD_RESET_TTL_MINUTES;
  const linkAbs = absoluteUrl(data.linkRedefinir, baseUrl);

  const subject = 'Redefinir sua senha no AIRPET';
  const preheader = `Use o link em até ${minutos} minutos para criar uma nova senha com segurança.`;

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Olá, <strong>${escapeHtml(nome)}</strong></p>`;

  const bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Recebemos um pedido para redefinir a senha desta conta. Defina uma nova senha em segundos — o link abaixo é só seu e expira em <strong>${minutos} minutos</strong>.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.textMuted};">
      Depois de expirar, é só solicitar outro e-mail na tela “Esqueci minha senha”.
    </p>`;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Redefinir sua senha',
    greetingHtml,
    bodyHtml,
    primaryCta: { href: linkAbs, label: 'Criar nova senha' },
    secondaryHtml: linkFallbackRow(linkAbs),
    footerExtra: `Você recebeu este e-mail porque alguém pediu redefinição de senha no AIRPET para este endereço.`,
    securityNoteHtml: `<strong>Se não foi você,</strong> pode ignorar este e-mail com tranquilidade — sua senha atual continua valendo e nada será alterado.`,
    baseUrl,
  });

  const text = [
    subject,
    '',
    `Olá, ${nome}`,
    '',
    `Alguém solicitou redefinição de senha. O link expira em ${minutos} minutos.`,
    linkAbs,
    '',
    'Se não foi você, ignore este e-mail.',
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildPasswordResetEmail };
