const { Resend } = require('resend');
const logger = require('../utils/logger');

let resendClient = null;

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('EmailService', 'RESEND_API_KEY não configurada. E-mails não serão enviados.');
    }
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFrom() {
  const email = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const name = process.env.RESEND_FROM_NAME || 'AIRPET';
  return `${name} <${email}>`;
}

async function enviarEmailBasico({ to, subject, html }) {
  const client = getClient();
  if (!client) return;

  try {
    await client.emails.send({
      from: getFrom(),
      to,
      subject,
      html,
    });
    logger.info('EmailService', `E-mail enviado: ${subject} → ${to}`);
  } catch (erro) {
    logger.error('EmailService', 'Falha ao enviar e-mail', erro);
  }
}

function layoutBase({ titulo, corpoHtml, ctaLink, ctaTexto }) {
  const botao =
    ctaLink && ctaTexto
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="border-radius:999px;background-color:#ec5a1c;padding:12px 24px;">
      <a href="${ctaLink}" style="color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;display:inline-block;">
        ${ctaTexto}
      </a>
    </td>
  </tr>
</table>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px 8px 24px;border-bottom:1px solid #f2f2f2;">
              <span style="display:inline-flex;align-items:center;gap:8px;color:#ec5a1c;font-weight:700;font-size:18px;">
                <span style="width:28px;height:28px;border-radius:999px;background:#ec5a1c1a;display:inline-flex;align-items:center;justify-content:center;font-size:16px;">🐾</span>
                AIRPET
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${corpoHtml}
              ${botao}
              <p style="margin-top:24px;font-size:12px;color:#9ca3af;line-height:1.5;">
                Se você não reconhece esta ação, pode ignorar este e-mail.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin-top:12px;font-size:11px;color:#9ca3af;max-width:600px;">
          © ${new Date().getFullYear()} AIRPET. Todos os direitos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const emailService = {
  async enviarBoasVindas({ to, nome }) {
    const titulo = 'Bem-vindo ao AIRPET 🐶✨';
    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">Olá, ${nome || 'tutor'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Sua conta no <strong>AIRPET</strong> foi criada com sucesso.
      </p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
        A partir de agora você pode cadastrar seus pets, ativar suas tags NFC e acompanhar tudo em um só lugar.
      </p>`;

    const ctaLink = `${process.env.BASE_URL || 'http://localhost:3000'}/explorar`;
    const html = layoutBase({ titulo, corpoHtml, ctaLink, ctaTexto: 'Começar a usar o AIRPET' });
    await enviarEmailBasico({ to, subject: titulo, html });
  },

  async enviarRedefinirSenha({ to, nome, linkRedefinir }) {
    const titulo = 'Redefinir senha da sua conta AIRPET';
    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">Oi, ${nome || 'tutor'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Recebemos um pedido para redefinir a senha da sua conta.
      </p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
        Clique no botão abaixo para criar uma nova senha. Este link é válido por tempo limitado.
      </p>`;

    const html = layoutBase({
      titulo,
      corpoHtml,
      ctaLink: linkRedefinir,
      ctaTexto: 'Redefinir minha senha',
    });
    await enviarEmailBasico({ to, subject: titulo, html });
  },

  async enviarParceiroRecebido({ to, empresaNome, responsavelNome }) {
    const titulo = 'Recebemos sua solicitação de parceria no AIRPET';
    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">Olá, ${responsavelNome || 'time'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Sua solicitação de parceria para <strong>${empresaNome || 'seu petshop'}</strong> foi recebida com sucesso.
      </p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
        Nosso time vai analisar as informações enviadas e você receberá um novo e-mail assim que a avaliação for concluída.
      </p>`;

    const html = layoutBase({ titulo, corpoHtml });
    await enviarEmailBasico({ to, subject: titulo, html });
  },

  async enviarParceiroAprovado({ to, empresaNome }) {
    const titulo = 'Parceria aprovada no AIRPET 🎉';
    const painelUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/petshop-panel/login`;
    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">Parabéns, ${empresaNome || 'parceiro'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Sua solicitação de parceria com o <strong>AIRPET</strong> foi aprovada.
      </p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
        Agora você já pode acessar o painel de parceiros para gerenciar sua presença na plataforma.
      </p>`;

    const html = layoutBase({
      titulo,
      corpoHtml,
      ctaLink: painelUrl,
      ctaTexto: 'Acessar painel do parceiro',
    });
    await enviarEmailBasico({ to, subject: titulo, html });
  },

  async enviarParceiroRejeitado({ to, empresaNome, motivo }) {
    const titulo = 'Atualização sobre sua parceria com o AIRPET';
    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">Olá, ${empresaNome || 'parceiro'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Após analisar sua solicitação de parceria, infelizmente ela não pôde ser aprovada neste momento.
      </p>
      ${
        motivo
          ? `<p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
        Motivo informado: ${motivo}
      </p>`
          : ''
      }`;

    const html = layoutBase({ titulo, corpoHtml });
    await enviarEmailBasico({ to, subject: titulo, html });
  },

  async enviarTagEnviada({ to, nome, tagCode, activationCode }) {
    const titulo = 'Sua tag AIRPET está a caminho 🐾';
    const linkAtivar = `${process.env.BASE_URL || 'http://localhost:3000'}/tags/${encodeURIComponent(
      tagCode
    )}/ativar`;

    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">Oi, ${nome || 'tutor'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Sua tag AIRPET já foi separada e está a caminho de você.
      </p>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Quando a tag chegar, você vai precisar destes dados:
      </p>
      <ul style="margin:8px 0 0 0;padding-left:18px;font-size:14px;color:#374151;line-height:1.6;">
        <li><strong>Código da tag:</strong> <code>${tagCode}</code></li>
        <li><strong>Código de ativação:</strong> <code>${activationCode}</code></li>
      </ul>`;

    const html = layoutBase({
      titulo,
      corpoHtml,
      ctaLink: linkAtivar,
      ctaTexto: 'Ativar minha tag (quando chegar)',
    });
    await enviarEmailBasico({ to, subject: titulo, html });
  },

  async enviarTagReservada({ to, nome, tagCode, activationCode }) {
    const titulo = 'Sua tag AIRPET foi reservada para você';
    const linkAtivar = `${process.env.BASE_URL || 'http://localhost:3000'}/tags/${encodeURIComponent(
      tagCode
    )}/ativar`;

    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">Oi, ${nome || 'tutor'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Reservamos uma tag AIRPET no seu nome. Assim que ela for enviada, você poderá ativá-la para proteger seu pet.
      </p>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        Guarde estes dados com carinho:
      </p>
      <ul style="margin:8px 0 0 0;padding-left:18px;font-size:14px;color:#374151;line-height:1.6;">
        <li><strong>Código da tag:</strong> <code>${tagCode}</code></li>
        <li><strong>Código de ativação:</strong> <code>${activationCode}</code></li>
      </ul>`;

    const html = layoutBase({
      titulo,
      corpoHtml,
      ctaLink: linkAtivar,
      ctaTexto: 'Ver como ativar minha tag',
    });
    await enviarEmailBasico({ to, subject: titulo, html });
  },

  async enviarTagEscaneada({ to, nome, petNome, cidade, linkPet }) {
    const titulo = `Alguém escaneou a tag de ${petNome || 'seu pet'}`;
    const cidadeTexto = cidade ? ` em ${cidade}` : '';
    const corpoHtml = `
      <h1 style="margin:0 0 12px 0;font-size:22px;color:#111827;">${nome || 'Olá'}!</h1>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
        A tag do(a) <strong>${petNome || 'seu pet'}</strong> foi escaneada${cidadeTexto}.
      </p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
        Acesse o AIRPET para ver mais detalhes e, se necessário, falar com quem encontrou.
      </p>`;

    const html = layoutBase({
      titulo,
      corpoHtml,
      ctaLink: linkPet,
      ctaTexto: 'Ver detalhes do meu pet',
    });
    await enviarEmailBasico({ to, subject: titulo, html });
  },
};

module.exports = emailService;

