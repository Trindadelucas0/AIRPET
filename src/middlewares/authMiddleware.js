/**
 * authMiddleware.js — Middleware de autenticacao do AIRPET
 *
 * Este middleware protege rotas que exigem que o usuario esteja logado.
 * Ele verifica duas formas de autenticacao:
 *   1. Sessao (req.session.usuario) — metodo principal, usado nas rotas web
 *   2. Token JWT no cookie "token" — fallback para quando a sessao nao existe,
 *      util em cenarios de API ou quando o cookie de sessao expirou mas o JWT ainda e valido
 *
 * Exporta duas funcoes:
 *   - estaAutenticado: para rotas web (redireciona para login se nao autenticado)
 *   - estaAutenticadoAPI: para rotas de API (retorna JSON 401 se nao autenticado)
 */

const jwt = require('jsonwebtoken');

/**
 * Tenta extrair e verificar o token JWT do cookie "token".
 * Se o token for valido, retorna o payload decodificado com os dados do usuario.
 * Se nao houver token ou ele for invalido/expirado, retorna null.
 *
 * @param {object} req - Objeto de requisicao do Express
 * @returns {object|null} Payload do JWT decodificado ou null
 */
function verificarTokenJWT(req) {
  // Busca o token no cookie "token" da requisicao
  const token = req.cookies && req.cookies.token;

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
function estaAutenticado(req, res, next) {
  // Primeiro verifica a sessao — metodo principal e mais rapido
  if (req.session && req.session.usuario) {
    // Usuario esta logado via sessao, pode prosseguir normalmente
    return next();
  }

  // Sessao nao encontrada — tenta o fallback via JWT
  const dadosJWT = verificarTokenJWT(req);

  if (dadosJWT) {
    // Token JWT e valido — restaura os dados do usuario na sessao
    // para que as proximas requisicoes nao precisem verificar o JWT novamente
    req.session.usuario = {
      id: dadosJWT.id,
      nome: dadosJWT.nome,
      email: dadosJWT.email,
      role: dadosJWT.role,
    };
    return next();
  }

  if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Voce precisa estar logado para acessar esta pagina.' };
  return res.redirect('/auth/login');
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
function estaAutenticadoAPI(req, res, next) {
  // Verifica sessao primeiro — mesmo fluxo do middleware web
  if (req.session && req.session.usuario) {
    return next();
  }

  // Tenta fallback via JWT
  const dadosJWT = verificarTokenJWT(req);

  if (dadosJWT) {
    // Restaura sessao a partir do JWT para consistencia
    req.session.usuario = {
      id: dadosJWT.id,
      nome: dadosJWT.nome,
      email: dadosJWT.email,
      role: dadosJWT.role,
    };
    return next();
  }

  // Sem autenticacao — retorna erro JSON com status 401
  return res.status(401).json({
    sucesso: false,
    mensagem: 'Autenticacao necessaria. Faca login para continuar.',
  });
}

module.exports = {
  estaAutenticado,
  estaAutenticadoAPI,
};
