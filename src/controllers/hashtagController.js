const Hashtag = require('../models/Hashtag');
const logger = require('../utils/logger');

function usuarioIdAtual(req) {
  if (req.session && req.session.usuario && req.session.usuario.id) return req.session.usuario.id;
  if (req.airpetApiUser && req.airpetApiUser.id) return req.airpetApiUser.id;
  return null;
}

async function pagina(req, res) {
  try {
    const slug = String(req.params.slug || '').trim();
    const tag = await Hashtag.buscarPorSlug(slug);
    if (!tag) {
      return res.status(404).render('partials/erro', {
        titulo: 'Hashtag não encontrada',
        mensagem: 'Esta hashtag não existe ou foi removida.',
        codigo: 404,
      });
    }
    const uid = usuarioIdAtual(req);
    const posts = await Hashtag.listarPostsPorHashtag(tag.id, 40, 0, uid);
    const totalSeguidores = await Hashtag.contarSeguidores(tag.id);
    const seguindo = uid ? await Hashtag.usuarioSegue(uid, tag.id) : false;

    res.render('hashtag', {
      titulo: `#${tag.slug}`,
      tag,
      posts,
      totalSeguidores,
      seguindo,
      uid,
    });
  } catch (err) {
    logger.error('HASHTAG', err);
    res.status(500).render('partials/erro', { titulo: 'Erro', mensagem: 'Erro ao carregar hashtag.', codigo: 500 });
  }
}

async function seguir(req, res) {
  try {
    const uid = usuarioIdAtual(req);
    if (!uid) {
      return res.status(401).json({ sucesso: false, mensagem: 'Faça login.' });
    }
    const tag = await Hashtag.buscarPorSlug(req.params.slug);
    if (!tag) return res.status(404).json({ sucesso: false });
    await Hashtag.seguir(uid, tag.id);
    const n = await Hashtag.contarSeguidores(tag.id);
    res.json({ sucesso: true, seguindo: true, totalSeguidores: n });
  } catch (err) {
    logger.error('HASHTAG_SEGUIR', err);
    res.status(500).json({ sucesso: false });
  }
}

async function deixarDeSeguir(req, res) {
  try {
    const uid = usuarioIdAtual(req);
    if (!uid) {
      return res.status(401).json({ sucesso: false, mensagem: 'Faça login.' });
    }
    const tag = await Hashtag.buscarPorSlug(req.params.slug);
    if (!tag) return res.status(404).json({ sucesso: false });
    await Hashtag.deixarDeSeguir(uid, tag.id);
    const n = await Hashtag.contarSeguidores(tag.id);
    res.json({ sucesso: true, seguindo: false, totalSeguidores: n });
  } catch (err) {
    logger.error('HASHTAG_DEIXAR', err);
    res.status(500).json({ sucesso: false });
  }
}

module.exports = { pagina, seguir, deixarDeSeguir };
