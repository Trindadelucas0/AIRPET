const rateLimit = require('express-rate-limit');

const JANELA_MS = 15 * 60 * 1000;

function handlerRateLimit(mensagemJson, mensagemFlash) {
  return (req, res) => {
    if (req.accepts('html')) {
      if (req.session) {
        req.session.flash = { tipo: 'erro', mensagem: mensagemFlash };
      }
      const voltar = req.headers.referer || '/';
      return res.redirect(voltar);
    }
    res.status(429).json(mensagemJson);
  };
}

const limiterGeral = rateLimit({
  windowMs: JANELA_MS,
  max: parseInt(process.env.RATE_LIMIT_GERAL, 10) || 500,
  handler: handlerRateLimit(
    { sucesso: false, mensagem: 'Muitas requisicoes. Tente novamente em alguns minutos.' },
    'Muitas requisições feitas. Aguarde alguns minutos e tente novamente.'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') return true;
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map|webp)$/)) return true;
    return false;
  },
});

const limiterAuth = rateLimit({
  windowMs: JANELA_MS,
  max: parseInt(process.env.RATE_LIMIT_AUTH, 10) || 20,
  handler: handlerRateLimit(
    { sucesso: false, mensagem: 'Muitas tentativas de autenticacao. Aguarde 15 minutos.' },
    'Muitas tentativas de autenticação. Aguarde 15 minutos antes de tentar novamente.'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

const limiterAtivacao = rateLimit({
  windowMs: JANELA_MS,
  max: parseInt(process.env.RATE_LIMIT_ATIVACAO, 10) || 10,
  handler: handlerRateLimit(
    { sucesso: false, mensagem: 'Muitas tentativas de ativacao. Aguarde 15 minutos.' },
    'Muitas tentativas de ativação. Aguarde 15 minutos antes de tentar novamente.'
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

module.exports = {
  limiterGeral,
  limiterAuth,
  limiterLogin: limiterAuth,
  limiterAtivacao,
};
