function petshopApprovalMiddleware(req, res, next) {
  const status = req.petshopAccount && req.petshopAccount.status;
  if (status !== 'ativo') {
    req.session.flash = {
      tipo: 'aviso',
      mensagem: 'Seu perfil ainda não foi aprovado para usar todos os recursos.',
    };
    return res.redirect('/petshop-panel/dashboard');
  }
  return next();
}

module.exports = { petshopApprovalMiddleware };
