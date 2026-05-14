const { query } = require('../config/database');

const HASHTAG_RE = /#([a-zA-Z0-9_\u00C0-\u017F]{2,50})/g;

function slugifyTag(raw) {
  let s = String(raw || '').toLowerCase().trim();
  if (!s) return '';
  const map = {
    á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
    é: 'e', è: 'e', ê: 'e', ë: 'e',
    í: 'i', ì: 'i', î: 'i', ï: 'i',
    ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
    ú: 'u', ù: 'u', û: 'u', ü: 'u',
    ç: 'c', ñ: 'n',
  };
  s = s.replace(/./g, (c) => map[c] || c);
  s = s.replace(/[^a-z0-9_]+/g, '');
  return s.slice(0, 50);
}

function extrairSlugs(texto) {
  const t = `${texto || ''}`;
  const out = new Set();
  let m;
  const re = new RegExp(HASHTAG_RE.source, 'g');
  while ((m = re.exec(t)) !== null) {
    const slug = slugifyTag(m[1]);
    if (slug.length >= 2) out.add(slug);
    if (out.size >= 10) break;
  }
  return [...out];
}

const Hashtag = {
  extrairSlugs,

  async syncPublicacao(publicacaoId, textoCompleto) {
    const slugs = extrairSlugs(textoCompleto);
    if (!slugs.length) return;
    await query('DELETE FROM post_hashtags WHERE publicacao_id = $1', [publicacaoId]);
    for (const slug of slugs) {
      const nome = `#${slug}`;
      const ins = await query(
        `INSERT INTO hashtags (slug, nome_exibicao, uso_count, ultima_atividade)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (slug) DO UPDATE SET
           uso_count = hashtags.uso_count + 1,
           ultima_atividade = NOW()
         RETURNING id`,
        [slug, nome]
      );
      const hid = ins.rows[0].id;
      await query(
        `INSERT INTO post_hashtags (publicacao_id, hashtag_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [publicacaoId, hid]
      );
    }
  },

  async buscarPorSlug(slug) {
    const s = slugifyTag(slug);
    if (!s) return null;
    const r = await query(
      `SELECT * FROM hashtags WHERE slug = $1 AND bloqueada = false LIMIT 1`,
      [s]
    );
    return r.rows[0] || null;
  },

  async contarPosts(hashtagId) {
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM post_hashtags WHERE hashtag_id = $1`,
      [hashtagId]
    );
    return r.rows[0].n;
  },

  async listarPostsPorHashtag(hashtagId, limite = 40, offset = 0, viewerId = null) {
    const Publicacao = require('./Publicacao');
    const r = await query(
      `SELECT p.id
       FROM publicacoes p
       JOIN post_hashtags ph ON ph.publicacao_id = p.id
       LEFT JOIN pets pet ON pet.id = p.pet_id
       WHERE ph.hashtag_id = $1
         AND (
           p.pet_id IS NULL OR NOT COALESCE(pet.privado, false)
           OR pet.usuario_id = COALESCE($4, 0)
           OR EXISTS (SELECT 1 FROM seguidores_pets sp WHERE sp.pet_id = p.pet_id AND sp.usuario_id = COALESCE($4, 0))
         )
       ORDER BY p.criado_em DESC
       LIMIT $2 OFFSET $3`,
      [hashtagId, limite, offset, viewerId || null]
    );
    const ids = r.rows.map((row) => row.id);
    if (!ids.length) return [];
    const posts = await Promise.all(ids.map((id) => Publicacao.buscarPorId(id, viewerId)));
    return posts.filter(Boolean);
  },

  async usuarioSegue(userId, hashtagId) {
    const r = await query(
      `SELECT 1 FROM hashtag_follows WHERE user_id = $1 AND hashtag_id = $2`,
      [userId, hashtagId]
    );
    return r.rows.length > 0;
  },

  async seguir(userId, hashtagId) {
    await query(
      `INSERT INTO hashtag_follows (user_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, hashtagId]
    );
  },

  async deixarDeSeguir(userId, hashtagId) {
    await query(`DELETE FROM hashtag_follows WHERE user_id = $1 AND hashtag_id = $2`, [userId, hashtagId]);
  },

  async contarSeguidores(hashtagId) {
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM hashtag_follows WHERE hashtag_id = $1`,
      [hashtagId]
    );
    return r.rows[0].n;
  },
};

module.exports = Hashtag;
