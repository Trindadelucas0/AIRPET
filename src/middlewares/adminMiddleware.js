function apenasAdmin(req, res, next) {
  const sessao = req.session || {};
  const adminViaSessaoLegada = !!sessao.admin;
  const adminViaUsuario = sessao.usuario && sessao.usuario.role === 'admin';
  if (!adminViaSessaoLegada && !adminViaUsuario) {
    const base = process.env.ADMIN_PATH || '/admin';
    return res.redirect(base + '/login');
  }
  return next();
}

module.exports = {
  apenasAdmin,
};
