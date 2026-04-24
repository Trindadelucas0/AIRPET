const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isStateChanging(method) {
  return !SAFE_METHODS.has(String(method || '').toUpperCase());
}

function normalizePath(rawPath) {
  const path = String(rawPath || '').trim();
  if (!path) return '/';
  if (path === '/') return '/';
  return path.startsWith('/') ? path.replace(/\/+$/, '') : `/${path}`.replace(/\/+$/, '');
}

const ADMIN_BASE_PATH = normalizePath(process.env.ADMIN_PATH || '/admin');

function isAdminLoginRequest(req) {
  if (String(req.method || '').toUpperCase() !== 'POST') return false;
  return normalizePath(req.path) === `${ADMIN_BASE_PATH}/login`;
}

function parseOriginFromUrl(raw) {
  try {
    return new URL(raw).origin;
  } catch (_) {
    return null;
  }
}

function csrfOriginGuardMiddleware(req, res, next) {
  if (!isStateChanging(req.method)) return next();
  if (isAdminLoginRequest(req)) return next();

  const hasSessionUser = Boolean(req.session && (req.session.usuario || req.session.petshopAccount));
  if (!hasSessionUser) return next();

  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  const origin = req.get('origin');
  const referer = req.get('referer');
  const sourceOrigin = origin || parseOriginFromUrl(referer);

  // Se não vier origem/referer (clientes não-browser), não bloqueia.
  if (!sourceOrigin) return next();

  if (sourceOrigin !== expectedOrigin) {
    return res.status(403).json({
      sucesso: false,
      mensagem: 'Requisição bloqueada por proteção CSRF.',
    });
  }
  return next();
}

module.exports = csrfOriginGuardMiddleware;
