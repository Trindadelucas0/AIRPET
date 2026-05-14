const { query } = require('../config/database');
const logger = require('../utils/logger');
const Petshop = require('./Petshop');
const PetshopPost = require('./PetshopPost');
const PetshopProduct = require('./PetshopProduct');

function safeDateToMs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function buscarWhatsappPorPetshopIds(petshopIds) {
  const ids = [...new Set((petshopIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Map();
  try {
    const result = await query(
      `SELECT petshop_id, whatsapp_publico
       FROM petshop_profiles
       WHERE petshop_id = ANY($1::int[])`,
      [ids]
    );
    const map = new Map();
    (result.rows || []).forEach((row) => {
      map.set(Number(row.petshop_id), row.whatsapp_publico || null);
    });
    return map;
  } catch (err) {
    logger.error('PETSHOP_PUBLICATION', 'buscarWhatsappPorPetshopIds', err);
    return new Map();
  }
}

async function preencherContagensEngajamento(publicacoes = []) {
  const postIds = publicacoes
    .filter((p) => p && p.sourceType === 'petshop_post')
    .map((p) => Number(p.sourceId))
    .filter((id) => Number.isInteger(id) && id > 0);
  const productIds = publicacoes
    .filter((p) => p && p.sourceType === 'petshop_product')
    .map((p) => Number(p.sourceId))
    .filter((id) => Number.isInteger(id) && id > 0);

  const promises = [];
  if (postIds.length) {
    promises.push(
      query(
        `SELECT publication_id, COUNT(*)::int AS total
         FROM petshop_publication_likes
         WHERE publication_type = 'petshop_post'
           AND publication_id = ANY($1::int[])
         GROUP BY publication_id`,
        [postIds]
      ),
      query(
        `SELECT publication_id, COUNT(*)::int AS total
         FROM petshop_publication_comments
         WHERE publication_type = 'petshop_post'
           AND publication_id = ANY($1::int[])
         GROUP BY publication_id`,
        [postIds]
      )
    );
  } else {
    promises.push(Promise.resolve({ rows: [] }), Promise.resolve({ rows: [] }));
  }
  if (productIds.length) {
    promises.push(
      query(
        `SELECT publication_id, COUNT(*)::int AS total
         FROM petshop_publication_likes
         WHERE publication_type = 'petshop_product'
           AND publication_id = ANY($1::int[])
         GROUP BY publication_id`,
        [productIds]
      ),
      query(
        `SELECT publication_id, COUNT(*)::int AS total
         FROM petshop_publication_comments
         WHERE publication_type = 'petshop_product'
           AND publication_id = ANY($1::int[])
         GROUP BY publication_id`,
        [productIds]
      )
    );
  } else {
    promises.push(Promise.resolve({ rows: [] }), Promise.resolve({ rows: [] }));
  }

  try {
    const [likesPost, commentsPost, likesProduct, commentsProduct] = await Promise.all(promises);
    const mapLikesPost = new Map((likesPost.rows || []).map((r) => [Number(r.publication_id), Number(r.total)]));
    const mapCommentsPost = new Map((commentsPost.rows || []).map((r) => [Number(r.publication_id), Number(r.total)]));
    const mapLikesProduct = new Map((likesProduct.rows || []).map((r) => [Number(r.publication_id), Number(r.total)]));
    const mapCommentsProduct = new Map((commentsProduct.rows || []).map((r) => [Number(r.publication_id), Number(r.total)]));

    return publicacoes.map((item) => {
      if (item.sourceType === 'petshop_post') {
        return {
          ...item,
          like_count: mapLikesPost.get(Number(item.sourceId)) || 0,
          comment_count: mapCommentsPost.get(Number(item.sourceId)) || 0,
        };
      }
      if (item.sourceType === 'petshop_product') {
        return {
          ...item,
          like_count: mapLikesProduct.get(Number(item.sourceId)) || 0,
          comment_count: mapCommentsProduct.get(Number(item.sourceId)) || 0,
        };
      }
      return item;
    });
  } catch (err) {
    logger.error('PETSHOP_PUBLICATION', 'preencherContagensEngajamento', err);
    return publicacoes.map((item) => ({
      ...item,
      like_count: 0,
      comment_count: 0,
    }));
  }
}

function mapPostToUnified(post, petshopMeta) {
  const publicationKey = `post:${post.id}`;
  return {
    publicationKey,
    sourceType: 'petshop_post',
    sourceId: post.id,
    publicationType: 'post',
    petshop_id: petshopMeta.id,
    petshop_nome: petshopMeta.nome,
    petshop_slug: petshopMeta.slug || null,
    petshop_logo_url: petshopMeta.logo_url || null,
    relationship_level: null,
    distance_metros: null,
    titulo: post.titulo || 'Postagem',
    descricao_curta: post.texto || post.legenda || null,
    texto: post.texto || post.legenda || null,
    foto_url: post.foto_url || null,
    preco: null,
    contato_link: null,
    badge: null,
    created_em: post.publicado_em || post.data_criacao || post.criado_em || post.data_atualizacao || null,
    is_highlighted: !!post.is_highlighted,
    highlight_rank: post.highlight_rank != null ? Number(post.highlight_rank) : 0,
    like_count: 0,
    comment_count: 0,
    curtiu: false,
    repostou: false,
    is_promocao: false,
    is_sponsored: false,
  };
}

function mapProductToUnified(product, petshopMeta) {
  const isPromo = !!product.is_promocao;
  const hasService = !isPromo && product.service_id != null;
  const publicationType = isPromo ? 'promocao' : (hasService ? 'servico' : 'produto');
  const publicationKey = `product:${product.id}`;
  return {
    publicationKey,
    sourceType: 'petshop_product',
    sourceId: product.id,
    publicationType,
    petshop_id: petshopMeta.id,
    petshop_nome: petshopMeta.nome,
    petshop_slug: petshopMeta.slug || null,
    petshop_logo_url: petshopMeta.logo_url || null,
    relationship_level: null,
    distance_metros: null,
    titulo: product.nome || 'Produto',
    descricao_curta: product.descricao || null,
    texto: product.descricao || null,
    foto_url: product.foto_url || null,
    preco: product.preco != null ? Number(product.preco) : null,
    contato_link: product.contato_link || null,
    badge: isPromo ? 'Promoção' : (hasService ? 'Serviço' : 'Produto'),
    created_em: product.data_criacao || null,
    is_highlighted: !!product.is_highlighted,
    highlight_rank: product.highlight_rank != null ? Number(product.highlight_rank) : 0,
    like_count: 0,
    comment_count: 0,
    curtiu: false,
    repostou: false,
    is_promocao: isPromo,
    servico_id: product.service_id != null ? Number(product.service_id) : null,
    is_servico: hasService,
    is_sponsored: false,
  };
}

/**
 * Lista publicações para a grade do perfil de um petshop específico.
 * Unifica:
 *  - petshop_posts (post normal)
 *  - petshop_products (produtos, e promoções com badge)
 */
async function listarPublicacoesParaGradePorPetshop(petshopId, opts = {}) {
  const {
    incluirPosts = true,
    incluirProdutos = true,
    incluirSomentePromocoes = false,
  } = opts;

  const petshopMeta = await Petshop.buscarPorId(petshopId);
  if (!petshopMeta) return [];

  const [posts, products] = await Promise.all([
    incluirPosts ? PetshopPost.listarPublicosPorPetshop(petshopId) : Promise.resolve([]),
    incluirProdutos ? PetshopProduct.listarAtivosPorPetshop(petshopId) : Promise.resolve([]),
  ]);

  const mappedPosts = (posts || []).map((p) => mapPostToUnified(p, petshopMeta));
  const mappedProducts = (products || [])
    .filter((pr) => (!incluirSomentePromocoes ? true : !!pr.is_promocao))
    .map((pr) => mapProductToUnified(pr, petshopMeta));

  const out = mappedPosts.concat(mappedProducts);
  out.sort((a, b) => {
    if (!!b.is_highlighted !== !!a.is_highlighted) return (b.is_highlighted ? 1 : 0) - (a.is_highlighted ? 1 : 0);
    const br = b.highlight_rank != null ? Number(b.highlight_rank) : 0;
    const ar = a.highlight_rank != null ? Number(a.highlight_rank) : 0;
    if (br !== ar) return br - ar;
    return safeDateToMs(b.created_em) - safeDateToMs(a.created_em);
  });
  return preencherContagensEngajamento(out);
}

/**
 * SQL dos posts de petshop para o feed de parceiros / explorar.
 * @returns {{ sql: string, params: unknown[] }}
 */
function sqlPetshopPostsParaFeedCards(useGeo, usuarioId, lat, lng, postsLimit) {
  if (useGeo) {
    const sql = `
    SELECT
      pp.id,
      pp.titulo,
      pp.texto,
      pp.foto_url,
      pp.publicado_em,
      pp.data_criacao,
      pp.is_highlighted,
      pp.highlight_rank,
      p.id AS petshop_id,
      p.nome AS petshop_nome,
      p.slug AS petshop_slug,
      p.logo_url AS petshop_logo_url,
      ST_Distance(
        p.localizacao,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) AS distancia_metros,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM pet_petshop_links ppl
          JOIN pets my_pet ON my_pet.id = ppl.pet_id
          WHERE ppl.petshop_id = p.id
            AND ppl.ativo = true
            AND my_pet.usuario_id = $3
        ) THEN 'vinculado'
        WHEN EXISTS (
          SELECT 1
          FROM petshop_followers pf
          WHERE pf.petshop_id = p.id AND pf.usuario_id = $3
        ) THEN 'seguindo'
        ELSE 'descoberta'
      END AS relationship_level
    FROM petshop_posts pp
    JOIN petshops p ON p.id = pp.petshop_id
    WHERE pp.ativo = true
      AND pp.approval_status = 'aprovado'
      AND pp.post_type = 'normal'
      AND p.ativo = true
      AND ST_DWithin(
        p.localizacao,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        50000
      )
    ORDER BY relationship_level ASC, distancia_metros ASC NULLS LAST, COALESCE(pp.publicado_em, pp.data_criacao) DESC
    LIMIT $4
    `;
    return { sql, params: [lat, lng, usuarioId, postsLimit] };
  }
  const sql = `
      SELECT
        pp.id,
        pp.titulo,
        pp.texto,
        pp.foto_url,
        pp.publicado_em,
        pp.data_criacao,
        pp.is_highlighted,
        pp.highlight_rank,
        p.id AS petshop_id,
        p.nome AS petshop_nome,
        p.slug AS petshop_slug,
        p.logo_url AS petshop_logo_url,
        NULL::numeric AS distancia_metros,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM pet_petshop_links ppl
            JOIN pets my_pet ON my_pet.id = ppl.pet_id
            WHERE ppl.petshop_id = p.id
              AND ppl.ativo = true
              AND my_pet.usuario_id = $1
          ) THEN 'vinculado'
          WHEN EXISTS (
            SELECT 1
            FROM petshop_followers pf
            WHERE pf.petshop_id = p.id AND pf.usuario_id = $1
          ) THEN 'seguindo'
          ELSE 'descoberta'
        END AS relationship_level
      FROM petshop_posts pp
      JOIN petshops p ON p.id = pp.petshop_id
      WHERE pp.ativo = true
        AND pp.approval_status = 'aprovado'
        AND pp.post_type = 'normal'
        AND p.ativo = true
      ORDER BY relationship_level ASC, COALESCE(pp.publicado_em, pp.data_criacao) DESC
      LIMIT $2
    `;
  return { sql, params: [usuarioId, postsLimit] };
}

/**
 * Lista cards (publicações) para o feed do `explorar`.
 * Por enquanto, retorna apenas o conteúdo base (sem likes/comments persistidos).
 * A priorização é feita via relacionamento local (vinculado > seguindo > descoberta)
 * e, quando há geo, por distância.
 */
async function listarCardsPublicacoesParaExplorar({ usuarioId, lat, lng, limite = 20 } = {}) {
  const limitSeguro = Number.isInteger(limite) && limite > 0 ? limite : 20;
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

  // 1) Promoções do tipo "produto" (is_promocao = true).
  const promLimit = Math.max(6, Math.floor(limitSeguro * 0.6));
  let promocoes = [];
  try {
    promocoes = await PetshopProduct.listarPromocoesProximas({
      usuarioId,
      lat,
      lng,
      limite: promLimit,
    });
  } catch (err) {
    logger.error('PETSHOP_PUBLICATION', 'listarPromocoesProximas (feed parceiros)', err);
  }

  // 2) Posts normais (petshop_posts).
  const postsLimit = Math.max(4, limitSeguro - (promocoes || []).length);

  let postsRows = [];
  try {
    const { sql, params } = sqlPetshopPostsParaFeedCards(hasGeo, usuarioId, lat, lng, postsLimit);
    postsRows = (await query(sql, params)).rows || [];
  } catch (err) {
    logger.error('PETSHOP_PUBLICATION', `petshop_posts feed (geo=${hasGeo})`, err);
    if (hasGeo) {
      try {
        const fb = sqlPetshopPostsParaFeedCards(false, usuarioId, lat, lng, postsLimit);
        postsRows = (await query(fb.sql, fb.params)).rows || [];
      } catch (err2) {
        logger.error('PETSHOP_PUBLICATION', 'petshop_posts feed sem geo (fallback)', err2);
        postsRows = [];
      }
    } else {
      postsRows = [];
    }
  }

  const petshopMetaById = new Map();
  const ensureMeta = (row) => {
    if (!petshopMetaById.has(row.petshop_id)) {
      petshopMetaById.set(row.petshop_id, {
        id: row.petshop_id,
        nome: row.petshop_nome,
        slug: row.petshop_slug,
        logo_url: row.petshop_logo_url,
      });
    }
    return petshopMetaById.get(row.petshop_id);
  };

  const mappedPosts = (postsRows || []).map((r) => {
    const meta = ensureMeta(r);
    const unified = mapPostToUnified(
      {
        id: r.id,
        titulo: r.titulo,
        texto: r.texto,
        foto_url: r.foto_url,
        publicado_em: r.publicado_em,
        data_criacao: r.data_criacao,
        is_highlighted: r.is_highlighted,
        highlight_rank: r.highlight_rank,
      },
      meta,
    );
    unified.relationship_level = r.relationship_level || null;
    unified.distance_metros = r.distancia_metros != null ? Number(r.distancia_metros) : null;
    return unified;
  });

  const mappedPromos = (promocoes || []).map((pr) => {
    const petshopMeta = {
      id: pr.petshop_id,
      nome: pr.petshop_nome,
      slug: pr.petshop_slug,
      logo_url: pr.petshop_logo_url,
    };
    const unified = mapProductToUnified(
      {
        id: pr.id,
        nome: pr.titulo,
        descricao: pr.descricao_curta,
        preco: pr.preco,
        foto_url: pr.foto_url,
        contato_link: pr.contato_link,
        is_promocao: true,
        data_criacao: pr.validade,
        is_highlighted: pr.is_highlighted,
        highlight_rank: pr.highlight_rank,
      },
      petshopMeta,
    );
    unified.relationship_level = pr.relationship_level || null;
    unified.distance_metros = pr.distancia_metros != null ? Number(pr.distancia_metros) : null;
    unified.badge = 'Promoção';
    unified.created_em = pr.validade || unified.created_em;
    return unified;
  });

  const relRank = { vinculado: 0, seguindo: 1, descoberta: 2 };
  mappedPromos.forEach((it) => { it.__relRank = relRank[it.relationship_level] ?? 3; });
  mappedPosts.forEach((it) => { it.__relRank = relRank[it.relationship_level] ?? 3; });

  const combined = mappedPosts.concat(mappedPromos);
  const whatsappByPetshop = await buscarWhatsappPorPetshopIds(combined.map((item) => item.petshop_id));
  combined.forEach((item) => {
    item.whatsapp_publico = whatsappByPetshop.get(Number(item.petshop_id)) || null;
  });
  combined.sort((a, b) => {
    const ra = a.__relRank ?? 3;
    const rb = b.__relRank ?? 3;
    if (ra !== rb) return ra - rb;
    const ah = a.is_highlighted ? 1 : 0;
    const bh = b.is_highlighted ? 1 : 0;
    if (ah !== bh) return bh - ah;
    const br = b.highlight_rank != null ? Number(b.highlight_rank) : 0;
    const ar = a.highlight_rank != null ? Number(a.highlight_rank) : 0;
    if (br !== ar) return br - ar;
    const da = a.distance_metros != null ? a.distance_metros : Number.POSITIVE_INFINITY;
    const db = b.distance_metros != null ? b.distance_metros : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return safeDateToMs(b.created_em) - safeDateToMs(a.created_em);
  });

  combined.forEach((it) => { delete it.__relRank; });
  const paged = combined.slice(0, limitSeguro);
  return preencherContagensEngajamento(paged);
}

module.exports = {
  listarPublicacoesParaGradePorPetshop,
  listarCardsPublicacoesParaExplorar,
};

