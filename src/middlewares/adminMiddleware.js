function apenasAdmin(req, res, next) {
  if (!req.session || !req.session.admin) {
    const base = process.env.ADMIN_PATH || '/admin';
    return res.redirect(base + '/login');
  }
  return next();
}

module.exports = {
  apenasAdmin,
};
