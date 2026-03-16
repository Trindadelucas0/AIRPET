const { query } = require('../config/database');

async function rateLimitPartnerSignupMiddleware(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_partner_requests
       WHERE data_criacao >= NOW() - INTERVAL '30 minutes'
         AND (
           email = $1
           OR telefone = $2
         )`,
      [req.body.email || '', req.body.telefone || '']
    );

    if ((result.rows[0] && result.rows[0].total) >= 3) {
      req.session.flash = {
        tipo: 'erro',
        mensagem: 'Muitas tentativas em pouco tempo. Tente novamente em alguns minutos.',
      };
      return res.redirect('/parceiros/cadastro');
    }

    req.partnerRequestIp = ip;
    return next();
  } catch (error) {
    return next();
  }
}

module.exports = { rateLimitPartnerSignupMiddleware };
