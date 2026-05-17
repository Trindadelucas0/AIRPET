const { buildTransactionalEmail } = require('../layout');
const { escapeHtml, absoluteUrl, linkFallbackRow, COLORS } = require('../components');

/**
 * @param {{ nome?: string, to: string, baseUrl?: string, linkLista?: string }} data
 */
function buildListaEsperaConfirmacaoEmail(data) {
  const baseUrl = data.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const nome = data.nome || 'tutor';
  const linkLista = data.linkLista || absoluteUrl('/proteger-meu-pet', baseUrl);

  const greetingHtml = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:${COLORS.text};">Olá, <strong>${escapeHtml(nome)}</strong></p>`;

  const bodyHtml = `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
    Recebemos sua inscrição na <strong>lista de espera do AIRPET</strong>. Quando abrirmos vagas na sua região, você será um dos primeiros a saber — sem spam, só o que importa.
  </p>
  <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
    <strong>Sorteio de AirTag (Apple):</strong> quem completa o formulário participa. Serão <strong>30 selecionados por cidade</strong> para testar uma AirTag com a gente, <strong>sem custo</strong> para você. A <strong>data do sorteio</strong> e as instruções enviamos pelo <strong>WhatsApp</strong> no número que você informou (por isso vale manter o celular atualizado).
  </p>
  <p style="margin:0 0 12px 0;font-size:12px;line-height:1.5;color:${COLORS.textMuted};">
    AirTag é marca da Apple Inc. O sorteio é promovido pelo AIRPET, sem vínculo com a Apple.
  </p>
  <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${COLORS.textMuted};">
    Se quiser indicar outro tutor, use o link de convite que aparece na tela de confirmação após enviar o formulário.
  </p>`;

  const subject = 'Você está na lista do AIRPET';
  const preheader = `${nome}, guardamos seu lugar. Avisaremos quando as vagas abrirem.`;

  const html = buildTransactionalEmail({
    preheader,
    documentTitle: subject,
    title: 'Lista de espera confirmada',
    greetingHtml,
    bodyHtml,
    primaryCta: { href: linkLista, label: 'Abrir página da lista de espera' },
    secondaryHtml: linkFallbackRow(linkLista),
    footerExtra: `Você recebeu este e-mail porque se inscreveu na lista de espera do AIRPET com o endereço ${escapeHtml(data.to)}.`,
    securityNoteHtml: `<strong>Segurança:</strong> nunca pedimos senha por e-mail. Se não foi você, ignore esta mensagem.`,
    baseUrl,
  });

  const text = [
    subject,
    '',
    `Olá, ${nome}`,
    '',
    'Recebemos sua inscrição na lista de espera do AIRPET.',
    'Sorteio AirTag: 30 por cidade, sem custo; data do sorteio avisamos pelo WhatsApp.',
    '',
    linkLista,
    '',
    `Este e-mail foi enviado para ${data.to} após inscrição na lista de espera.`,
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildListaEsperaConfirmacaoEmail };
