const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');

async function rateLimitPartnerSignupMiddleware(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const total = await PetshopPartnerRequest.contarRecentesPorEmailOuTelefone(
      req.body.email || '',
      req.body.telefone || ''
    );

    if (total >= 3) {
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
