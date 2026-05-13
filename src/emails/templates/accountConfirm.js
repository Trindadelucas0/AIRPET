const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, absoluteUrl, linkFallbackRow, COLORS } = require('../components');

/**
 * Fluxo de confirmação ainda não ligado às rotas — template pronto para quando existir token/rota.
 * @param {{ nome?: string, linkConfirmacao: string, baseUrl?: string }} data
 */
function buildAccountConfirmEmail(data) {
  const baseUrl = data.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const nome = data.nome || 'tutor';
  const linkAbs = absoluteUrl(data.linkConfirmacao, baseUrl);

  const subject = 'Confirme seu e-mail no AIRPET';
  const preheader = 'Um clique para validar seu endereço e manter sua conta protegida.';

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Olá, <strong>${escapeHtml(nome)}</strong></p>`;

  const bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Quase lá: confirme que este e-mail é seu para mantermos sua conta segura e avisos importantes sempre no lugar certo.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.textMuted};">
      Leva menos de um segundo.
    </p>`;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Confirmar seu e-mail',
    greetingHtml,
    bodyHtml,
    primaryCta: { href: linkAbs, label: 'Confirmar meu e-mail' },
    secondaryHtml: linkFallbackRow(linkAbs),
    footerExtra: `Você recebeu este e-mail porque uma conta AIRPET precisa validar este endereço.`,
    securityNoteHtml: `<strong>Se não foi você</strong> quem criou ou atualizou a conta, ignore — nenhuma alteração será feita sem este passo.`,
    baseUrl,
  });

  const text = [subject, '', `Olá, ${nome}`, '', 'Confirme seu e-mail:', linkAbs, '', 'Se não foi você, ignore.'].join('\n');

  return { subject, html, text };
}

module.exports = { buildAccountConfirmEmail };
