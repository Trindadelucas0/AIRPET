function promotionModerationMiddleware(req, res, next) {
  const postType = String(req.body.post_type || req.body.tipo || '').toLowerCase();
  req.body.approval_status = postType === 'promocao' ? 'pendente' : 'aprovado';
  return next();
}

module.exports = { promotionModerationMiddleware };
