function petshopOwnerMiddleware(req, res, next) {
  if (!req.petshopAccount || !req.petshopAccount.petshop_id) {
    req.session.flash = { tipo: 'erro', mensagem: 'Sessão de parceiro inválida.' };
    return res.redirect('/petshop-panel/auth/login');
  }
  return next();
}

module.exports = { petshopOwnerMiddleware };
