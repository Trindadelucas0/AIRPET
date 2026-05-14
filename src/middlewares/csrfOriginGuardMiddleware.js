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

/** Prefixo do painel admin (lido em cada pedido para testes e hot-reload de env). */
function adminBasePath() {
  return normalizePath(process.env.ADMIN_PATH || '/admin');
}

function requestPathname(req) {
  const raw = String(req.originalUrl || req.url || '').split('?')[0];
  return normalizePath(raw);
}

/**
 * Formulários e POSTs do painel montado em ADMIN_PATH — não aplicar verificação de Origin
 * (evita 403 quando existe sessão de app + admin; req.path no mount não inclui o prefixo).
 */
function isAdminAreaMutation(req) {
  if (!isStateChanging(req.method)) return false;
  const base = adminBasePath();
  if (!base || base === '/') return false;
  const pathOnly = requestPathname(req);
  return pathOnly === base || pathOnly.startsWith(`${base}/`);
}

function parseOriginFromUrl(raw) {
  try {
    return new URL(raw).origin;
  } catch (_) {
    return null;
  }
}

/** Origem que o browser deveria enviar (proxy / TLS terminado no edge). */
function getExpectedOrigin(req) {
  const xfProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  const xfHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
  const proto = xfProto || String(req.protocol || 'http').replace(/:$/, '').toLowerCase() || 'http';
  const host = xfHost || req.get('host') || '';
  if (!host) return null;
  return `${proto}://${host}`;
}

function parseOriginParts(originStr) {
  try {
    const u = new URL(originStr);
    const defaultPort = u.protocol === 'https:' ? '443' : '80';
    const port = u.port || String(defaultPort);
    let hostname = u.hostname.toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }
    return { protocol: u.protocol, hostname, port: String(port) };
  } catch (_) {
    return null;
  }
}

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLocalDevLoopbackMatch(a, b) {
  if (process.env.NODE_ENV === 'production') return false;
  if (!a || !b) return false;
  if (a.protocol !== b.protocol || a.port !== b.port) return false;
  return LOCAL_DEV_HOSTS.has(a.hostname) && LOCAL_DEV_HOSTS.has(b.hostname);
}

function originsMatch(req, sourceOrigin) {
  const expectedStr = getExpectedOrigin(req);
  if (!expectedStr) return true;

  const exp = parseOriginParts(expectedStr);
  const src = parseOriginParts(sourceOrigin);
  if (!exp || !src) return false;

  if (exp.protocol === src.protocol && exp.hostname === src.hostname && exp.port === src.port) {
    return true;
  }
  return isLocalDevLoopbackMatch(exp, src);
}

function csrfOriginGuardMiddleware(req, res, next) {
  if (!isStateChanging(req.method)) return next();
  if (isAdminAreaMutation(req)) return next();

  const hasSessionUser = Boolean(req.session && (req.session.usuario || req.session.petshopAccount));
  if (!hasSessionUser) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');
  const sourceOrigin = origin || parseOriginFromUrl(referer);

  // Se não vier origem/referer (clientes não-browser), não bloqueia.
  if (!sourceOrigin) return next();

  if (!originsMatch(req, sourceOrigin)) {
    return res.status(403).json({
      sucesso: false,
      mensagem: 'Requisição bloqueada por proteção CSRF.',
    });
  }
  return next();
}

csrfOriginGuardMiddleware.__internals = {
  getExpectedOrigin,
  originsMatch,
  adminBasePath,
  requestPathname,
  isAdminAreaMutation,
};

module.exports = csrfOriginGuardMiddleware;
