const { Resend } = require('resend');
const logger = require('../utils/logger');
const { buildWelcomeEmail } = require('../emails/templates/welcome');
const { buildPasswordResetEmail } = require('../emails/templates/passwordReset');
const { buildAccountConfirmEmail } = require('../emails/templates/accountConfirm');
const { buildSecurityAlertEmail } = require('../emails/templates/securityAlert');
const { buildTagScannedEmail } = require('../emails/templates/tagScanned');
const { buildPartnerReceivedEmail } = require('../emails/templates/partnerReceived');
const { buildPartnerApprovedEmail } = require('../emails/templates/partnerApproved');
const { buildPartnerRejectedEmail } = require('../emails/templates/partnerRejected');
const { buildTagShippedEmail } = require('../emails/templates/tagShipped');
const { buildTagReservedEmail } = require('../emails/templates/tagReserved');
const { buildListaEsperaConfirmacaoEmail } = require('../emails/templates/listaEsperaConfirmacao');

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

function baseUrl() {
  return process.env.BASE_URL || 'http://localhost:3000';
}

async function enviarEmailBasico({ to, subject, html, text }) {
  const client = getClient();
  if (!client) return;

  const payload = {
    from: getFrom(),
    to,
    subject,
    html,
  };
  if (text) payload.text = text;

  try {
    await client.emails.send(payload);
    logger.info('EmailService', `E-mail enviado: ${subject} → ${to}`);
  } catch (erro) {
    logger.error('EmailService', 'Falha ao enviar e-mail', erro);
  }
}

const emailService = {
  /**
   * @param {{ to: string, nome?: string, pets?: Array<object> }} opts
   */
  async enviarBoasVindas({ to, nome, pets }) {
    const { subject, html, text } = buildWelcomeEmail({ nome, pets, baseUrl: baseUrl() });
    await enviarEmailBasico({ to, subject, html, text });
  },

  /**
   * @param {{ to: string, nome?: string, linkRedefinir: string, minutosValidade?: number }} opts
   */
  async enviarRedefinirSenha({ to, nome, linkRedefinir, minutosValidade }) {
    const { subject, html, text } = buildPasswordResetEmail({
      nome,
      linkRedefinir,
      minutosValidade,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },

  /**
   * Template pronto para fluxo futuro de verificação de e-mail.
   * @param {{ to: string, nome?: string, linkConfirmacao: string }} opts
   */
  async enviarConfirmacaoConta({ to, nome, linkConfirmacao }) {
    const { subject, html, text } = buildAccountConfirmEmail({
      nome,
      linkConfirmacao,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },

  /**
   * Alerta genérico (ação no sistema, segurança, etc.).
   * @param {{ to: string, nome?: string, subject: string, headline: string, messagePlain: string, ctaLink?: string, ctaTexto?: string, reasonLine?: string, preheader?: string }} opts
   */
  async enviarAlertaImportante(opts) {
    const { to, ...rest } = opts;
    const { subject, html, text } = buildSecurityAlertEmail({ ...rest, baseUrl: baseUrl() });
    await enviarEmailBasico({ to, subject, html, text });
  },

  async enviarParceiroRecebido({ to, empresaNome, responsavelNome }) {
    const { subject, html, text } = buildPartnerReceivedEmail({
      empresaNome,
      responsavelNome,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },

  async enviarParceiroAprovado({ to, empresaNome }) {
    const { subject, html, text } = buildPartnerApprovedEmail({ empresaNome, baseUrl: baseUrl() });
    await enviarEmailBasico({ to, subject, html, text });
  },

  async enviarParceiroRejeitado({ to, empresaNome, motivo }) {
    const { subject, html, text } = buildPartnerRejectedEmail({
      empresaNome,
      motivo,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },

  async enviarTagEnviada({ to, nome, tagCode, activationCode }) {
    const { subject, html, text } = buildTagShippedEmail({
      nome,
      tagCode,
      activationCode,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },

  async enviarTagReservada({ to, nome, tagCode, activationCode }) {
    const { subject, html, text } = buildTagReservedEmail({
      nome,
      tagCode,
      activationCode,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },

  /**
   * Confirmação após inscrição na lista de espera (wizard /lista-espera).
   * @param {{ to: string, nome?: string }} opts
   */
  async enviarListaEsperaConfirmacao({ to, nome }) {
    const { subject, html, text } = buildListaEsperaConfirmacaoEmail({
      to,
      nome,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },

  async enviarTagEscaneada({ to, nome, petNome, cidade, linkPet }) {
    const { subject, html, text } = buildTagScannedEmail({
      nome,
      petNome,
      cidade,
      linkPet,
      baseUrl: baseUrl(),
    });
    await enviarEmailBasico({ to, subject, html, text });
  },
};

module.exports = emailService;
