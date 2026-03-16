const PetshopAccount = require('../models/PetshopAccount');

async function petshopAuthMiddleware(req, res, next) {
  if (!req.session || !req.session.petshopAccount) {
    return res.redirect('/petshop-panel/auth/login');
  }

  const account = await PetshopAccount.buscarPorId(req.session.petshopAccount.id);
  if (!account || account.status === 'bloqueado') {
    req.session.petshopAccount = null;
    req.session.flash = { tipo: 'erro', mensagem: 'Sua conta de parceiro não está disponível.' };
    return res.redirect('/petshop-panel/auth/login');
  }

  req.petshopAccount = account;
  return next();
}

module.exports = { petshopAuthMiddleware };
