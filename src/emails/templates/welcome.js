const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, absoluteUrl, linkFallbackRow, petHighlightCard, COLORS } = require('../components');

function especieLabelPet(p) {
  if (!p) return '';
  const t = (p.tipo_custom || p.tipo || '').trim();
  return t || '';
}

/**
 * @param {{ nome?: string, pets?: Array<{ nome?: string, tipo?: string, tipo_custom?: string, foto?: string }>, baseUrl?: string }} data
 */
function buildWelcomeEmail(data) {
  const baseUrl = data.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const nome = data.nome || 'tutor';
  const first = Array.isArray(data.pets) && data.pets.length ? data.pets[0] : null;
  const exploreUrl = absoluteUrl('/explorar', baseUrl);

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Olá, <strong>${escapeHtml(nome)}</strong></p>`;

  let bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
    Sua conta AIRPET está pronta. Cadastre seu pet e ative a tag NFC para que, se ele se perder, quem encontrar consiga falar com você com segurança.
  </p>`;

  if (first) {
    const fotoAbs = first.foto ? absoluteUrl(first.foto, baseUrl) : '';
    bodyHtml += petHighlightCard({
      nomePet: first.nome,
      especieLabel: especieLabelPet(first),
      fotoUrl: fotoAbs,
    });
    bodyHtml += `<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Quer adicionar outro pet ou completar o perfil de ${escapeHtml(first.nome || 'seu pet')}? Leva menos de um minuto.
    </p>`;
  } else {
    bodyHtml += `<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
      Quando quiser, cadastre seu pet em um minuto — é o primeiro passo para nunca mais perdê-lo de vista.
    </p>`;
  }

  const subject = 'Sua conta AIRPET está pronta';
  const preheader = `${nome}, cadastre seu pet e mantenha a proteção NFC sempre à mão.`;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Bem-vindo ao AIRPET',
    greetingHtml,
    bodyHtml,
    primaryCta: { href: exploreUrl, label: 'Abrir o AIRPET' },
    secondaryHtml: linkFallbackRow(exploreUrl),
    footerExtra: `Você recebeu este e-mail porque acabou de criar uma conta no AIRPET com este endereço.`,
    securityNoteHtml: `<strong>Segurança:</strong> nunca pedimos senha por e-mail. Se não foi você quem criou a conta, ignore esta mensagem.`,
    baseUrl,
  });

  const text = [
    `${subject}`,
    '',
    `Olá, ${nome}`,
    '',
    'Sua conta AIRPET está pronta. Cadastre seu pet e ative a tag NFC para proteção se ele se perder.',
    '',
    `Abrir o AIRPET: ${exploreUrl}`,
    '',
    'Se não foi você quem criou a conta, ignore este e-mail.',
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildWelcomeEmail };
