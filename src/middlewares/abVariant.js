/**
 * Variante A/B para copy do funil (cookie lp_variant).
 */
function assignAbVariant(req, res, next) {
  let v = String(req.cookies?.lp_variant || '').toUpperCase();
  if (v !== 'A' && v !== 'B') {
    v = Math.random() < 0.5 ? 'A' : 'B';
    res.cookie('lp_variant', v, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: false,
      path: '/',
    });
  }
  res.locals.lpVariant = v;
  res.locals.FUNIL_PLAUSIBLE_DOMAIN = (process.env.PLAUSIBLE_DOMAIN || '').trim();
  res.locals.FUNIL_GA_MEASUREMENT_ID = (process.env.GA_MEASUREMENT_ID || '').trim();
  res.locals.FUNIL_DEBUG = process.env.FUNIL_ANALYTICS_DEBUG === 'true';
  next();
}

module.exports = { assignAbVariant };
