/**
 * authMiddleware.js — Middleware de autenticacao do AIRPET
 *
 * Este middleware protege rotas que exigem que o usuario esteja logado.
 * Ele verifica duas formas de autenticacao:
 *   1. Sessao (req.session.usuario) — metodo principal, usado nas rotas web
 *   2. Token JWT no cookie "airpet_token" (ou "token" legado) — fallback para quando a sessao nao existe,
 *      util em cenarios de API ou quando o cookie de sessao expirou mas o JWT ainda e valido
 *
 * Exporta duas funcoes:
 *   - estaAutenticado: para rotas web (redireciona para login se nao autenticado)
 *   - estaAutenticadoAPI: para rotas de API (retorna JSON 401 se nao autenticado)
 */

const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const logger = require('../utils/logger');

/**
 * Tenta extrair e verificar o token JWT dos cookies de autenticacao.
 * Se o token for valido, retorna o payload decodificado com os dados do usuario.
 * Se nao houver token ou ele for invalido/expirado, retorna null.
 *
 * @param {object} req - Objeto de requisicao do Express
 * @returns {object|null} Payload do JWT decodificado ou null
 */
function verificarTokenJWT(req) {
  // Prioriza o cookie atual do AIRPET e mantém compatibilidade com cookie legado.
  const token = req.cookies && (req.cookies.airpet_token || req.cookies.token);

  // Se nao existe cookie com token, nao ha fallback possivel
  if (!token) return null;

  try {
    // Verifica a assinatura e validade do token usando o segredo do .env
    // Se o token for valido, retorna o payload (ex: { id, email, role })
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (erro) {
    // Token invalido, expirado ou com assinatura incorreta — ignora silenciosamente
    // pois o usuario sera redirecionado para login de qualquer forma
    return null;
  }
}

/**
 * JWT no header Authorization: Bearer <token> — usado por app mobile e clientes API.
 */
function verificarBearerJWT(req) {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = /^Bearer\s+(\S+)/i.exec(h.trim());
  if (!m) return null;
  try {
    return jwt.verify(m[1], process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/** Fetch/XHR que pede JSON não deve receber redirect HTML do middleware web. */
function clienteEsperaJson(req) {
  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json')) return true;
  const xrw = String(req.get('x-requested-with') || '').toLowerCase();
  if (xrw === 'xmlhttprequest') return true;
  return false;
}

/**
 * estaAutenticado — Middleware para rotas WEB
 *
 * Fluxo de verificacao:
 *   1. Verifica se existe req.session.usuario (login via sessao)
 *   2. Se nao, tenta verificar o token JWT do cookie como fallback
 *   3. Se o JWT for valido, restaura a sessao do usuario automaticamente
 *   4. Se nenhuma autenticacao for encontrada, redireciona para /auth/login
 *      com uma mensagem flash informando que e necessario fazer login
 *
 * @param {object} req - Requisicao do Express
 * @param {object} res - Resposta do Express
 * @param {function} next - Proximo middleware na cadeia
 */
async function estaAutenticado(req, res, next) {
  try {
    // Primeiro verifica a sessao — metodo principal e mais rapido
    if (req.session && req.session.usuario) {
      const usuario = await Usuario.buscarPorId(req.session.usuario.id);
      if (!usuario) {
        logger.warn('AUTH_MW', `Sessao para usuario inexistente, destruindo sessao: ${req.session.usuario.id}`);
        const idAntigo = req.session.usuario.id;
        req.session.destroy(() => {});
        res.clearCookie('airpet_token');
        res.clearCookie('connect.sid');
        if (req.session) {
          req.session.flash = {
            tipo: 'erro',
            mensagem: 'Sua conta nao existe mais no AIRPET. Voce pode criar uma nova conta agora.',
          };
        }
        if (clienteEsperaJson(req)) {
          return res.status(401).json({
            sucesso: false,
            motivo: 'usuario_inexistente',
            mensagem: 'Sua conta nao existe mais. Faca login ou crie uma nova conta.',
          });
        }
        return res.redirect('/auth/registro');
      }
      return next();
    }

    // Sessao nao encontrada — tenta o fallback via JWT
    const dadosJWT = verificarTokenJWT(req);

    if (dadosJWT) {
      const usuario = await Usuario.buscarPorId(dadosJWT.id);
      if (!usuario) {
        logger.warn('AUTH_MW', `Token JWT para usuario inexistente, limpando cookies: ${dadosJWT.id}`);
        res.clearCookie('airpet_token');
        res.clearCookie('connect.sid');
        if (req.session) {
          req.session.flash = {
            tipo: 'erro',
            mensagem: 'Sua conta nao existe mais no AIRPET. Voce pode criar uma nova conta agora.',
          };
        }
        if (clienteEsperaJson(req)) {
          return res.status(401).json({
            sucesso: false,
            motivo: 'usuario_inexistente',
            mensagem: 'Sua conta nao existe mais. Faca login ou crie uma nova conta.',
          });
        }
        return res.redirect('/auth/registro');
      }

      req.session.usuario = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
      };
      return next();
    }

    if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Voce precisa estar logado para acessar esta pagina.' };
    if (clienteEsperaJson(req)) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Autenticacao necessaria. Faca login para continuar.',
      });
    }
    const returnUrl = (req.originalUrl || req.url || '').trim();
    const q = returnUrl && returnUrl.startsWith('/') ? '?returnUrl=' + encodeURIComponent(returnUrl) : '';
    return res.redirect('/auth/login' + q);
  } catch (erro) {
    logger.error('AUTH_MW', 'Erro inesperado no middleware estaAutenticado', erro);
    if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Erro de autenticacao. Faca login novamente.' };
    if (clienteEsperaJson(req)) {
      return res.status(401).json({ sucesso: false, mensagem: 'Erro de autenticacao. Faca login novamente.' });
    }
    return res.redirect('/auth/login');
  }
}

/**
 * estaAutenticadoAPI — Middleware para rotas de API (JSON)
 *
 * Funciona de forma identica ao estaAutenticado, porem ao inves de
 * redirecionar, retorna uma resposta JSON com status 401 (Unauthorized).
 * Isso e necessario porque chamadas fetch/axios do frontend esperam
 * respostas JSON, nao redirecionamentos HTML.
 *
 * @param {object} req - Requisicao do Express
 * @param {object} res - Resposta do Express
 * @param {function} next - Proximo middleware na cadeia
 */
async function estaAutenticadoAPI(req, res, next) {
  try {
    function continuarApiAutenticado() {
      req.airpetApiUser = (req.session && req.session.usuario) || req.airpetAuthUser || null;
      return next();
    }

    // Verifica sessao primeiro — mesmo fluxo do middleware web
    if (req.session && req.session.usuario) {
      const usuario = await Usuario.buscarPorId(req.session.usuario.id);
      if (!usuario) {
        logger.warn('AUTH_MW', `API: sessao para usuario inexistente, destruindo sessao: ${req.session.usuario.id}`);
        req.session.destroy(() => {});
        res.clearCookie('airpet_token');
        res.clearCookie('connect.sid');
        return res.status(401).json({
          sucesso: false,
          motivo: 'usuario_inexistente',
          mensagem: 'Sua conta nao existe mais. Faca login ou crie uma nova conta.',
        });
      }
      return continuarApiAutenticado();
    }

    // Bearer (mobile / API): não grava sessão no store — req.airpetAuthUser + req.airpetApiUser
    const dadosBearer = verificarBearerJWT(req);
    if (dadosBearer) {
      const usuario = await Usuario.buscarPorId(dadosBearer.id);
      if (!usuario || usuario.bloqueado) {
        return res.status(401).json({
          sucesso: false,
          motivo: 'usuario_inexistente',
          mensagem: 'Sua conta nao existe mais ou esta bloqueada.',
        });
      }
      req.airpetAuthUser = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        cor_perfil: usuario.cor_perfil || '#ec5a1c',
        foto_perfil: usuario.foto_perfil || null,
        apelido: usuario.apelido || null,
      };
      return continuarApiAutenticado();
    }

    // Tenta fallback via JWT no cookie
    const dadosJWT = verificarTokenJWT(req);

    if (dadosJWT) {
      const usuario = await Usuario.buscarPorId(dadosJWT.id);
      if (!usuario) {
        logger.warn('AUTH_MW', `API: token JWT para usuario inexistente, limpando cookies: ${dadosJWT.id}`);
        res.clearCookie('airpet_token');
        res.clearCookie('connect.sid');
        return res.status(401).json({
          sucesso: false,
          motivo: 'usuario_inexistente',
          mensagem: 'Sua conta nao existe mais. Faca login ou crie uma nova conta.',
        });
      }

      req.session.usuario = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
      };
      return continuarApiAutenticado();
    }

    // Sem autenticacao — retorna erro JSON com status 401
    return res.status(401).json({
      sucesso: false,
      mensagem: 'Autenticacao necessaria. Faca login para continuar.',
    });
  } catch (erro) {
    logger.error('AUTH_MW', 'Erro inesperado no middleware estaAutenticadoAPI', erro);
    return res.status(401).json({
      sucesso: false,
      mensagem: 'Erro de autenticacao. Faca login novamente.',
    });
  }
}

module.exports = {
  estaAutenticado,
  estaAutenticadoAPI,
};
