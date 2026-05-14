const fs = require('fs');
const path = require('path');
const Publicacao = require('../models/Publicacao');
const Curtida = require('../models/Curtida');
const Comentario = require('../models/Comentario');
const Seguidor = require('../models/Seguidor');
const Repost = require('../models/Repost');
const Pet = require('../models/Pet');
const Usuario = require('../models/Usuario');
const SeguidorPet = require('../models/SeguidorPet');
const PetPetshopLink = require('../models/PetPetshopLink');
const Petshop = require('../models/Petshop');
const PetshopFollower = require('../models/PetshopFollower');
const PetshopPublication = require('../models/PetshopPublication');
const PetshopPostLike = require('../models/PetshopPostLike');
const PetshopPostComment = require('../models/PetshopPostComment');
const recomendacaoService = require('../services/recomendacaoService');
const logger = require('../utils/logger');
const PostIdempotencyKey = require('../models/PostIdempotencyKey');
const PostInteractionRaw = require('../models/PostInteractionRaw');
const PostMention = require('../models/PostMention');
const CommentMention = require('../models/CommentMention');
const PostTag = require('../models/PostTag');
const PostMedia = require('../models/PostMedia');
const Story = require('../models/Story');
const PetDoMes = require('../models/PetDoMes');
const petsMaisFofinhosEligibility = require('../services/petsMaisFofinhosEligibility');
const socialPostHooks = require('../services/socialPostHooks');
const { multerPublicUrl } = require('../middlewares/persistUploadMiddleware');

function getNotificacaoService() {
  try { return require('../services/notificacaoService'); } catch (_) { return null; }
}

/** Sessão web ou API JSON (estaAutenticadoAPI preenche req.airpetApiUser). */
function usuarioAtor(req) {
  return req.airpetApiUser || (req.session && req.session.usuario) || null;
}

async function notificarMencoes(texto, autorId, publicacaoId, contexto = 'publicacao') {
  const nomes = PostMention.extrairMencoes(texto);
  if (!nomes.length) return;
  const usuarios = await PostMention.resolverUsuariosPorNome(nomes);
  const svc = getNotificacaoService();
  if (!svc) return;
  const autor = await Usuario.buscarPorId(autorId);
  for (const u of usuarios) {
    if (u.id === autorId) continue;
    try {
      const mensagem = contexto === 'comentario'
        ? `${autor.nome} mencionou você em um comentário.`
        : `${autor.nome} mencionou você em uma publicação.`;
      await svc.criar(u.id, 'mencao', mensagem, `/explorar#post-${publicacaoId}`, { remetente_id: autorId, publicacao_id: publicacaoId });
    } catch (_) {}
  }
}

function buildPostRequestHash(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64').slice(0, 80);
}

function parsePetshopPublicationKey(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  // Formatos esperados:
  // - post:123
  // - product:456
  // - post-123 / product-456 (fallback)
  const parts = value.includes(':') ? value.split(':') : value.split('-');
  if (!parts || parts.length < 2) return null;
  const typePart = String(parts[0]).toLowerCase();
  const idPart = String(parts.slice(1).join('-')).trim();
  const publicationId = parseInt(idPart, 10);
  if (!Number.isFinite(publicationId) || publicationId <= 0) return null;

  if (typePart === 'post' || typePart === 'petshop_post') return { publicationType: 'petshop_post', publicationId };
  if (typePart === 'product' || typePart === 'petshop_product') return { publicationType: 'petshop_product', publicationId };
  return null;
}

async function tryGetIdempotentResponse(uid, idempotencyKey, requestHash) {
  if (!idempotencyKey) return null;
  await PostIdempotencyKey.limparExpiradas();
  const existing = await PostIdempotencyKey.buscarValida(uid, idempotencyKey);
  if (!existing) return null;
  if (existing.request_hash && requestHash && existing.request_hash !== requestHash) {
    return { status: 409, payload: { sucesso: false, mensagem: 'Idempotency-Key reutilizada com payload diferente.' } };
  }
  return { status: existing.status_code || 200, payload: existing.response_body || { sucesso: true } };
}

async function saveIdempotentResponse(uid, idempotencyKey, requestHash, statusCode, payload) {
  if (!idempotencyKey) return;
  await PostIdempotencyKey.salvarOuAtualizar(uid, idempotencyKey, requestHash, statusCode, payload);
}

async function autoDeleteSeNecessario(usuarioId) {
  const total = await Publicacao.contarAtivas(usuarioId);
  if (total < Publicacao.MAX_POSTS) return null;
  const antiga = await Publicacao.buscarMaisAntigaNaoFixada(usuarioId);
  if (!antiga) return null;
  await Publicacao.deletar(antiga.id);
  if (antiga.foto) {
    const caminho = path.join(__dirname, '..', 'public', antiga.foto);
    fs.unlink(caminho, () => {});
  }
  return antiga;
}

async function validarPetDonoOuFalhar(petId, usuarioId, mensagem = 'Pet não encontrado ou você não é o dono.', { obrigatorio = false } = {}) {
  if (!petId) {
    if (obrigatorio) {
      const erro = new Error('Escolha um pet para publicar.');
      erro.code = 'PET_ID_OBRIGATORIO';
      throw erro;
    }
    return null;
  }
  const pet = await Pet.buscarPorId(petId);
  if (!pet || pet.usuario_id !== usuarioId) {
    const erro = new Error(mensagem);
    erro.code = 'PET_NAO_PERTENCE';
    throw erro;
  }
  return pet;
}

/** Explorar: só exibe cards com mídia (texto só não entra na grade). */
function postTemMidiaExplorar(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.is_petshop_publication) return !!(p.foto_url && String(p.foto_url).trim());
  if (p.is_sponsored) return !!(p.foto && String(p.foto).trim());
  if (p.foto && String(p.foto).trim()) return true;
  if (p.tipo === 'repost' && p.orig_foto && String(p.orig_foto).trim()) return true;
  return false;
}

function filtrarPostsExplorarComMidia(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.filter(postTemMidiaExplorar);
}

function selecionarPatrocinado(patrocinados, cursor, ultimoPetId) {
  if (!Array.isArray(patrocinados) || !patrocinados.length) {
    return { item: null, nextCursor: cursor };
  }

  let tentativa = 0;
  let proximoCursor = cursor;
  let escolhido = null;

  while (tentativa < patrocinados.length) {
    const candidato = patrocinados[proximoCursor % patrocinados.length];
    proximoCursor += 1;
    tentativa += 1;
    if (!candidato) continue;
    if (ultimoPetId && candidato.pet_id === ultimoPetId && tentativa < patrocinados.length) continue;
    escolhido = candidato;
    break;
  }

  return { item: escolhido, nextCursor: proximoCursor };
}

function mesclarPostsComPatrocinados(postsOrganicos, patrocinados, pagina = 1) {
  if (!Array.isArray(postsOrganicos) || !Array.isArray(patrocinados) || !patrocinados.length) {
    return postsOrganicos;
  }

  const posicoesBase = pagina === 1 ? [2, 6, 11] : [5, 13];
  const maxPatrocinados = pagina === 1 ? 3 : 2;
  const posicoes = posicoesBase.slice(0, Math.min(maxPatrocinados, patrocinados.length));
  if (!posicoes.length) return postsOrganicos;

  const resultado = [];
  let cursorPatrocinado = (Math.max(1, pagina) - 1) % patrocinados.length;
  let ultimoPetPatrocinado = null;
  let totalInseridos = 0;

  for (let i = 0; i < postsOrganicos.length; i += 1) {
    resultado.push(postsOrganicos[i]);
    const posicaoAtual = i + 1;
    if (!posicoes.includes(posicaoAtual)) continue;

    const { item, nextCursor } = selecionarPatrocinado(patrocinados, cursorPatrocinado, ultimoPetPatrocinado);
    cursorPatrocinado = nextCursor;
    if (!item) continue;

    ultimoPetPatrocinado = item.pet_id;
    resultado.push({
      ...item,
      id: item.id || ('sponsored-' + item.boost_id + '-' + item.pet_id),
      is_sponsored: true,
      sponsored_key: 'sponsored-' + item.boost_id + '-' + item.pet_id + '-p' + pagina + '-i' + i,
    });
    totalInseridos += 1;
  }

  // Regra mínima: com boost ativo, sempre exibir ao menos 1 patrocinado por página.
  if (totalInseridos === 0) {
    const { item } = selecionarPatrocinado(patrocinados, cursorPatrocinado, ultimoPetPatrocinado);
    if (item) {
      resultado.unshift({
        ...item,
        id: item.id || ('sponsored-' + item.boost_id + '-' + item.pet_id),
        is_sponsored: true,
        sponsored_key: 'sponsored-' + item.boost_id + '-' + item.pet_id + '-p' + pagina + '-forced',
      });
    }
  }

  return resultado;
}

function mesclarPostsComPromocoes(posts, promocoes, pagina = 1) {
  if (pagina !== 1 || !Array.isArray(posts) || !Array.isArray(promocoes) || !promocoes.length) {
    return posts;
  }
  const promocao = promocoes[0];
  const pos = Math.min(5, posts.length);
  const item = {
    ...promocao,
    id: 'promo-feed-' + promocao.id,
    is_petshop_promo: true,
    promo_key: 'promo-feed-' + promocao.id + '-p' + pagina,
  };
  const out = posts.slice();
  out.splice(pos, 0, item);
  return out;
}

function mesclarPostsComPetshopPublicacoes(posts, petshopPublicacoes, pagina = 1) {
  if (pagina !== 1) return posts;
  if (!Array.isArray(posts) || !Array.isArray(petshopPublicacoes) || !petshopPublicacoes.length) return posts;

  // Mantém o feed limpo: adiciona só alguns cards do parceiro no início.
  const cards = petshopPublicacoes.slice(0, 3);
  if (!cards.length) return posts;

  const posicoesBase = [3, 7, 12]; // posições 1-based no array final já com patrocinados
  const out = [];
  let inseridos = 0;

  for (let i = 0; i < posts.length; i += 1) {
    out.push(posts[i]);
    const posicaoAtual = i + 1;
    if (inseridos < cards.length && posicoesBase.includes(posicaoAtual)) {
      out.push(cards[inseridos]);
      inseridos += 1;
    }
    if (inseridos >= cards.length) break;
  }

  if (inseridos < cards.length) {
    out.push(...cards.slice(inseridos));
  }

  // Se interrompeu cedo, mantém o resto de posts.
  if (out.length < posts.length + inseridos) {
    out.push(...posts.slice(out.length - inseridos));
  }

  return out.slice(0, Math.max(posts.length, out.length));
}

function mulberry32Explorar(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Intercala recentes (cronológico) e populares (engajamento), ~60/40, sem duplicar id. */
function explorarIntercalarRecentesPopulares(recentes, populares, limite) {
  const seen = new Set();
  const out = [];
  let i = 0;
  let j = 0;
  let streakRecent = 0;
  while (out.length < limite && (i < recentes.length || j < populares.length)) {
    if (streakRecent < 2 && i < recentes.length) {
      const p = recentes[i++];
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
      streakRecent += 1;
      continue;
    }
    if (j < populares.length) {
      const p = populares[j++];
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
      streakRecent = 0;
      continue;
    }
    streakRecent = 0;
    while (i < recentes.length && out.length < limite) {
      const p = recentes[i++];
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
    break;
  }
  return out;
}

function explorarMixOrdenacao(posts, seed) {
  if (!Array.isArray(posts) || posts.length < 2) return posts;
  const rng = mulberry32Explorar(seed >>> 0);
  const arr = posts.slice();
  for (let k = arr.length - 1; k > 0; k -= 1) {
    const r = Math.floor(rng() * (k + 1));
    const tmp = arr[k];
    arr[k] = arr[r];
    arr[r] = tmp;
  }
  return arr;
}

const EXPLORAR_SPAN_ALL = ['1x1', '1x2', '2x1', '2x2'];

function aplicarSpansExplorarMosaico(posts, seed) {
  if (!Array.isArray(posts) || !posts.length) return;
  const rng = mulberry32Explorar((seed ^ 0x243f6a88) >>> 0);
  let lastSpan = null;
  posts.forEach((p) => {
    const popular = !p.is_sponsored && !p.is_petshop_publication
      && Number(p.total_curtidas || 0) >= 12;
    let choices;
    if (p.is_sponsored || p.is_petshop_publication) {
      choices = rng() < 0.12 ? ['2x2', '1x1', '2x1'] : ['1x1', '2x1', '1x2'];
    } else if (popular && rng() < 0.28) {
      choices = ['2x2', '1x1', '2x1', '1x2'];
    } else {
      choices = ['1x1', '1x2', '2x1', '2x2'];
    }
    let pick = choices[Math.floor(rng() * choices.length)];
    if (pick === lastSpan) {
      const alt = EXPLORAR_SPAN_ALL.filter((s) => s !== lastSpan);
      pick = alt[Math.floor(rng() * alt.length)];
    }
    lastSpan = pick;
    p.explorar_tile_span = pick;
  });
}

const explorarController = {

  async feedSeguidos(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const page = parseInt(req.query.page) || 1;
      const limite = 20;
      const offset = (page - 1) * limite;

      const postsOrganicos = await Publicacao.feedSeguindoPets(uid, limite, offset);
      const posts = postsOrganicos;

      const [pets, totalPosts, totalFixadas, recomendacoes, petsRecomendados] = await Promise.all([
        Pet.buscarPorUsuario(uid),
        Publicacao.contarAtivas(uid),
        Publicacao.contarFixadas(uid),
        page === 1 ? recomendacaoService.recomendarPessoas(uid, 6).catch(() => []) : [],
        page === 1 ? recomendacaoService.petsRecomendados(uid, 8).catch(() => []) : [],
      ]);
      const petshopsProximos = page === 1 ? (await Petshop.listarAtivos()).slice(0, 6) : [];

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({
          sucesso: true,
          posts,
          totalPosts,
          totalFixadas,
          temMais: postsOrganicos.length === limite,
          page,
        });
      }

      res.render('feed', {
        titulo: 'Feed',
        posts,
        page,
        pets,
        totalPosts,
        totalFixadas,
        temMais: postsOrganicos.length === limite,
        recomendacoes,
        petsRecomendados,
        petshopsProximos,
        feedAbaAtiva: 'pets',
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no feed de seguidos', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o feed.' };
      res.redirect('/pets');
    }
  },

  async feedParceiros(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const u = await Usuario.buscarPorId(uid);
      let lat = null;
      let lng = null;
      if (u && u.ultima_lat != null && u.ultima_lng != null) {
        const la = parseFloat(u.ultima_lat);
        const lo = parseFloat(u.ultima_lng);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          lat = la;
          lng = lo;
        }
      }
      const cards = await PetshopPublication.listarCardsPublicacoesParaExplorar({
        usuarioId: uid,
        lat,
        lng,
        limite: 40,
      });
      let pets = [];
      try {
        pets = await Pet.buscarPorUsuario(uid);
      } catch (petErr) {
        logger.error('EXPLORAR', 'Erro ao listar pets no feed parceiros', petErr);
      }
      res.render('feed-parceiros', {
        titulo: 'Parceiros',
        cards: cards || [],
        pets,
        feedAbaAtiva: 'parceiros',
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no feed parceiros', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o feed de parceiros.' };
      res.redirect('/feed');
    }
  },

  async feed(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const page = parseInt(req.query.page, 10) || 1;
      const limite = 20;
      const offset = (page - 1) * limite;
      const poolMix = 28;

      let layoutSeed = ((uid * 1103515245 + page * 12345) ^ 0xa5a5a5a5) >>> 0;
      let postsOrganicos;
      let temMaisOrganico;

      if (page === 1) {
        layoutSeed = (Math.floor(Math.random() * 0x7fffffff) | 0) >>> 0;
        const [regLimite, recentesPool, popularesPool] = await Promise.all([
          Publicacao.feedRegional(uid, limite, 0),
          Publicacao.feedRegional(uid, poolMix, 0),
          Publicacao.feedRegionalPorEngajamento(uid, poolMix, 0),
        ]);
        temMaisOrganico = regLimite.length === limite;

        let rec = recentesPool.slice();
        if (rec.length < 5) {
          const cidadePosts = await Publicacao.feedRegionalCidade(uid, poolMix - rec.length, 0);
          const idsJaTem = new Set(rec.map((p) => p.id));
          for (const p of cidadePosts) {
            if (!idsJaTem.has(p.id)) rec.push(p);
          }
        }

        if (rec.length === 0) {
          const gRecent = await Publicacao.feedGeral(poolMix, 0, uid);
          const gPop = await Publicacao.feedGeralPorEngajamento(poolMix, 0, uid);
          postsOrganicos = explorarIntercalarRecentesPopulares(gRecent, gPop, limite);
          postsOrganicos = explorarMixOrdenacao(postsOrganicos, layoutSeed);
          const gMore = await Publicacao.feedGeral(limite + 1, 0, uid);
          temMaisOrganico = gMore.length > limite;
        } else {
          postsOrganicos = explorarIntercalarRecentesPopulares(rec, popularesPool, limite);
          postsOrganicos = explorarMixOrdenacao(postsOrganicos, layoutSeed);
        }
      } else {
        postsOrganicos = await Publicacao.feedRegional(uid, limite, offset);
        temMaisOrganico = postsOrganicos.length === limite;

        if (postsOrganicos.length < 5) {
          const cidadePosts = await Publicacao.feedRegionalCidade(uid, limite - postsOrganicos.length, offset);
          const idsJaTem = new Set(postsOrganicos.map((p) => p.id));
          for (const p of cidadePosts) {
            if (!idsJaTem.has(p.id)) postsOrganicos.push(p);
          }
        }

        if (postsOrganicos.length === 0) {
          postsOrganicos = await Publicacao.feedGeral(limite, offset, uid);
          temMaisOrganico = postsOrganicos.length === limite;
        }
      }

      const patrocinados = await Publicacao.buscarPatrocinadosPetAtivos(uid, 8);
      let posts = mesclarPostsComPatrocinados(postsOrganicos, patrocinados, page);

      if (page === 1) {
        const usuario = await Usuario.buscarPorId(uid);
        const lat = usuario && usuario.ultima_lat;
        const lng = usuario && usuario.ultima_lng;
        const petshopPublicacoes = await PetshopPublication.listarCardsPublicacoesParaExplorar({
          usuarioId: uid,
          lat,
          lng,
          limite: 6,
        }).catch(() => []);

        const petshopPublicacoesMarcadas = (petshopPublicacoes || []).map((p) => ({
          ...p,
          is_petshop_publication: true,
        }));

        posts = mesclarPostsComPetshopPublicacoes(posts, petshopPublicacoesMarcadas, page);
      }

      posts = filtrarPostsExplorarComMidia(posts);
      aplicarSpansExplorarMosaico(posts, layoutSeed);

      const [pets, totalPosts, totalFixadas, recomendacoes, petsRecomendados] = await Promise.all([
        Pet.buscarPorUsuario(uid),
        Publicacao.contarAtivas(uid),
        Publicacao.contarFixadas(uid),
        page === 1 ? recomendacaoService.recomendarPessoas(uid, 6).catch(() => []) : [],
        page === 1 ? recomendacaoService.petsRecomendados(uid, 8).catch(() => []) : [],
      ]);
      const petshopDestaques = page === 1 ? (await Petshop.listarAtivos()).slice(0, 6) : [];

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({
          sucesso: true,
          posts,
          totalPosts,
          totalFixadas,
          layoutSeed,
          temMais: temMaisOrganico,
          page,
        });
      }

      res.render('explorar', {
        titulo: 'Explorar',
        posts,
        page,
        pets,
        totalPosts,
        totalFixadas,
        temMais: temMaisOrganico,
        layoutSeed,
        recomendacoes,
        petsRecomendados,
        petshopDestaques,
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no feed regional', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o explorar.' };
      res.redirect('/pets');
    }
  },

  async criarPost(req, res) {
    try {
      const uid = usuarioAtor(req)?.id;
      if (!uid) {
        return res.status(401).json({ sucesso: false, mensagem: 'Faça login para publicar.' });
      }
      const { texto, pet_id } = req.body || {};
      const foto = multerPublicUrl(req.file, 'posts');

      if (!texto && !foto) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva algo ou envie uma imagem.' });
      }
      const textoLimpo = String(texto || '').trim();
      const petId = pet_id ? parseInt(pet_id, 10) : null;
      await validarPetDonoOuFalhar(petId, uid, undefined, { obrigatorio: true });

      const requestHash = buildPostRequestHash({
        texto: textoLimpo,
        pet_id: petId || null,
        foto_nome: req.file?.originalname || '',
        foto_tamanho: req.file?.size || 0,
      });
      const idempotencyKey = String(req.get('Idempotency-Key') || req.get('X-Idempotency-Key') || '').trim().slice(0, 120);
      const idempotente = await tryGetIdempotentResponse(uid, idempotencyKey, requestHash);
      if (idempotente) {
        return res.status(idempotente.status).json(idempotente.payload);
      }

      const ultimo = await Publicacao.ultimoPostDoUsuario(uid);
      if (ultimo && (Date.now() - new Date(ultimo.criado_em).getTime()) < 3000) {
        const payload = { sucesso: false, mensagem: 'Aguarde alguns segundos antes de publicar novamente.' };
        await saveIdempotentResponse(uid, idempotencyKey, requestHash, 429, payload);
        return res.status(429).json(payload);
      }
      const repetido = await Publicacao.buscarRecenteIgual(uid, textoLimpo, petId || null, 15);
      if (repetido) {
        const postExistente = await Publicacao.buscarPorId(repetido.id, uid);
        const totalPostsExistente = await Publicacao.contarAtivas(uid);
        const payload = { sucesso: true, post: postExistente, totalPosts: totalPostsExistente, removido: null, duplicado: true };
        await saveIdempotentResponse(uid, idempotencyKey, requestHash, 200, payload);
        return res.json(payload);
      }

      const removido = await autoDeleteSeNecessario(uid);

      const rawMoldura = req.body?.fofinhos_moldura;
      const querMoldura =
        rawMoldura === true || rawMoldura === 1 || rawMoldura === '1' || rawMoldura === 'true';
      let fofinhosMoldura = false;
      if (querMoldura && petId) {
        const det = await petsMaisFofinhosEligibility.detalheElegibilidadePet(petId);
        fofinhosMoldura = !!det.elegivel;
      }

      const post = await Publicacao.criar({
        usuario_id: uid,
        pet_id: petId || null,
        foto,
        legenda: textoLimpo || null,
        texto: textoLimpo || null,
        fofinhos_moldura: fofinhosMoldura,
      });
      if (foto) {
        await PostMedia.criar(post.id, foto, 'image', 0, 'ready');
      }
      const nomesMencionados = PostMention.extrairMencoes(textoLimpo);
      const usuariosMencionados = await PostMention.resolverUsuariosPorNome(nomesMencionados);
      await PostMention.criarEmLote(post.id, uid, usuariosMencionados.map((u) => u.id));
      await notificarMencoes(textoLimpo, uid, post.id, 'publicacao');

      await socialPostHooks.aposCriarPublicacao({
        postId: post.id,
        petId: petId || null,
        autorUserId: uid,
        texto: textoLimpo || null,
        legenda: textoLimpo || null,
        lat: req.body?.lat,
        lng: req.body?.lng,
        local_nome: req.body?.local_nome,
      });

      const completo = await Publicacao.buscarPorId(post.id, uid);
      const totalPosts = await Publicacao.contarAtivas(uid);
      const payload = { sucesso: true, post: completo, totalPosts, removido: removido ? removido.id : null };
      await saveIdempotentResponse(uid, idempotencyKey, requestHash, 200, payload);
      res.json(payload);
    } catch (err) {
      if (err && err.code === 'PET_ID_OBRIGATORIO') {
        return res.status(400).json({ sucesso: false, mensagem: err.message || 'Escolha um pet para publicar.' });
      }
      if (err && err.code === 'PET_NAO_PERTENCE') {
        return res.status(400).json({ sucesso: false, mensagem: 'Pet não encontrado ou você não é o dono.' });
      }
      logger.error('EXPLORAR', 'Erro ao criar post', err);
      const msg = process.env.NODE_ENV === 'production'
        ? 'Erro ao publicar. Tente novamente.'
        : (err.message || 'Erro ao publicar.');
      res.status(500).json({ sucesso: false, mensagem: msg });
    }
  },

  async repostar(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const { texto } = req.body;

      if (!texto || !texto.trim()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva algo ao repostar.' });
      }

      const original = await Publicacao.buscarPorId(id);
      if (!original) {
        return res.status(404).json({ sucesso: false, mensagem: 'Post não encontrado.' });
      }

      await Repost.repostar(uid, id);

      const removido = await autoDeleteSeNecessario(uid);

      const post = await Publicacao.criar({
        usuario_id: uid, repost_id: parseInt(id), tipo: 'repost',
        texto: texto.trim(), legenda: texto.trim(),
      });

      const completo = await Publicacao.buscarPorId(post.id, uid);
      const totalReposts = await Repost.contar(id);

      const svc = getNotificacaoService();
      if (svc && original.usuario_id !== uid) {
        const autor = await Usuario.buscarPorId(uid);
        svc.criar(original.usuario_id, 'repost', `${autor.nome} repostou sua publicação.`, `/explorar#post-${id}`, { remetente_id: uid, publicacao_id: parseInt(id), pet_id: original.pet_id || null }).catch(() => {});
      }

      res.json({ sucesso: true, post: completo, totalReposts, removido: removido ? removido.id : null });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao repostar', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async curtir(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      await Curtida.curtir(uid, id);
      const total = await Curtida.contar(id);

      const svc = getNotificacaoService();
      if (svc) {
        const post = await Publicacao.buscarPorId(id);
        if (post && post.usuario_id !== uid) {
          const autor = await Usuario.buscarPorId(uid);
          svc.criar(post.usuario_id, 'curtida', `${autor.nome} curtiu sua publicação.`, `/explorar#post-${id}`, { remetente_id: uid, publicacao_id: parseInt(id), pet_id: post.pet_id || null }).catch(() => {});
        }
      }

      res.json({ sucesso: true, curtiu: true, total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao curtir', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async descurtir(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      await Curtida.descurtir(uid, id);
      const total = await Curtida.contar(id);
      res.json({ sucesso: true, curtiu: false, total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao descurtir', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async comentarios(req, res) {
    try {
      const { id } = req.params;
      const lista = await Comentario.buscarArvorePorPublicacao(id);
      res.json({ sucesso: true, comentarios: lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar comentários', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async comentar(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const { texto, parent_id: parentIdBody, parentId: parentIdAlt } = req.body || {};
      const parentIdRaw = parentIdBody != null ? parentIdBody : parentIdAlt;

      if (!texto || !texto.trim()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva algo.' });
      }

      let novo;
      try {
        novo = await Comentario.criar({
          usuario_id: uid,
          publicacao_id: id,
          texto: texto.trim(),
          parent_id: parentIdRaw,
        });
      } catch (e) {
        if (e && e.code === 'COMMENT_INVALID_PARENT') {
          return res.status(400).json({ sucesso: false, mensagem: 'Resposta inválida.' });
        }
        throw e;
      }
      const nomesMencionados = PostMention.extrairMencoes(texto.trim());
      const usuariosMencionados = await PostMention.resolverUsuariosPorNome(nomesMencionados);
      await CommentMention.criarEmLote(novo.id, uid, usuariosMencionados.map((u) => u.id));
      notificarMencoes(texto.trim(), uid, id, 'comentario').catch(() => {});

      const svc = getNotificacaoService();
      const post = await Publicacao.buscarPorId(id);
      const autor = await Usuario.buscarPorId(uid);
      if (svc && post) {
        if (!novo.parent_id && post.usuario_id !== uid) {
          svc.criar(post.usuario_id, 'comentario', `${autor.nome} comentou na sua publicação.`, `/explorar#post-${id}`, { remetente_id: uid, publicacao_id: parseInt(id, 10), pet_id: post.pet_id || null }).catch(() => {});
        }
        if (novo.parent_id) {
          const pai = await Comentario.buscarPorId(novo.parent_id);
          if (pai && pai.usuario_id !== uid) {
            svc.criar(
              pai.usuario_id,
              'comentario',
              `${autor.nome} respondeu ao seu comentário.`,
              `/explorar#post-${id}`,
              { remetente_id: uid, publicacao_id: parseInt(id, 10), pet_id: post.pet_id || null }
            ).catch(() => {});
          }
        }
      }

      const lista = await Comentario.buscarArvorePorPublicacao(id);
      const total = await Comentario.contar(id);
      res.json({ sucesso: true, comentarios: lista, total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao comentar', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async curtirPetshopPublicacao(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params; // publicaçãoKey (post:123 / product:456)
      const parsed = parsePetshopPublicationKey(id);
      if (!parsed) return res.status(400).json({ sucesso: false, mensagem: 'Publicação inválida.' });

      await PetshopPostLike.curtir(uid, parsed.publicationType, parsed.publicationId);
      const total = await PetshopPostLike.contar(parsed.publicationType, parsed.publicationId);
      return res.json({ sucesso: true, curtiu: true, total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao curtir publicação petshop', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async descurtirPetshopPublicacao(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const parsed = parsePetshopPublicationKey(id);
      if (!parsed) return res.status(400).json({ sucesso: false, mensagem: 'Publicação inválida.' });

      await PetshopPostLike.descurtir(uid, parsed.publicationType, parsed.publicationId);
      const total = await PetshopPostLike.contar(parsed.publicationType, parsed.publicationId);
      return res.json({ sucesso: true, curtiu: false, total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao descurtir publicação petshop', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async comentariosPetshopPublicacao(req, res) {
    try {
      const { id } = req.params; // publicaçãoKey
      const parsed = parsePetshopPublicationKey(id);
      if (!parsed) return res.status(400).json({ sucesso: false, mensagem: 'Publicação inválida.' });

      const lista = await PetshopPostComment.listarPorPublicacao(parsed.publicationType, parsed.publicationId);
      return res.json({ sucesso: true, comentarios: lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar comentários petshop', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async comentarPetshopPublicacao(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const parsed = parsePetshopPublicationKey(id);
      if (!parsed) return res.status(400).json({ sucesso: false, mensagem: 'Publicação inválida.' });

      const { texto } = req.body || {};
      if (!texto || !texto.trim()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva algo.' });
      }

      const novo = await PetshopPostComment.criar({
        usuario_id: uid,
        publicationType: parsed.publicationType,
        publicationId: parsed.publicationId,
        texto: String(texto).trim(),
      });
      const total = await PetshopPostComment.contarPorPublicacao(parsed.publicationType, parsed.publicationId);
      return res.json({ sucesso: true, comentario: novo, total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao comentar publicação petshop', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async deletarComentario(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const check = await Comentario.buscarPorId(id);
      if (!check || check.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });
      }
      await Comentario.deletar(id);
      res.json({ sucesso: true });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao deletar comentário', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async fixar(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const post = await Publicacao.buscarPorId(id);

      if (!post || post.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });
      }

      const fixadas = await Publicacao.contarFixadas(uid);
      if (fixadas >= Publicacao.MAX_FIXADAS) {
        return res.status(400).json({ sucesso: false, mensagem: `Você já tem ${Publicacao.MAX_FIXADAS} posts fixados. Desafixe um antes.` });
      }

      await Publicacao.fixar(id);
      res.json({ sucesso: true, fixada: true });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao fixar', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async desafixar(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const post = await Publicacao.buscarPorId(id);

      if (!post || post.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });
      }

      await Publicacao.desafixar(id);
      res.json({ sucesso: true, fixada: false });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao desafixar', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async deletarPost(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const post = await Publicacao.buscarPorId(id);

      if (!post || post.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });
      }

      await Publicacao.deletar(id);
      if (post.foto) {
        const caminho = path.join(__dirname, '..', 'public', post.foto);
        fs.unlink(caminho, () => {});
      }
      res.json({ sucesso: true });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao deletar post', err);
      res.status(500).json({
        sucesso: false,
        mensagem: 'Não foi possível excluir a publicação agora. Tente novamente em alguns instantes.'
      });
    }
  },

  async seguir(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      if (parseInt(id) === uid) {
        return res.status(400).json({ sucesso: false, mensagem: 'Você não pode seguir a si mesmo.' });
      }
      await Seguidor.seguir(uid, id);
      const total = await Seguidor.contarSeguidores(id);

      const svc = getNotificacaoService();
      if (svc) {
        const autor = await Usuario.buscarPorId(uid);
        svc.criar(parseInt(id), 'seguidor', `${autor.nome} começou a seguir você.`, `/explorar/perfil/${uid}`, { remetente_id: uid }).catch(() => {});
      }

      res.json({ sucesso: true, seguindo: true, totalSeguidores: total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao seguir', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async deixarDeSeguir(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      await Seguidor.deixarDeSeguir(uid, id);
      const total = await Seguidor.contarSeguidores(id);
      res.json({ sucesso: true, seguindo: false, totalSeguidores: total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao deixar de seguir', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async perfilPet(req, res) {
    try {
      const { id } = req.params;
      const uid = usuarioAtor(req) ? usuarioAtor(req).id : null;
      const pet = await Pet.buscarPorId(id);
      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/explorar');
      }
      const posts = await Publicacao.buscarPorPet(id, uid, 50);
      const [totalSeguidores, totalSeguindo, estaSeguindo, petshopsVinculados] = await Promise.all([
        SeguidorPet.contarSeguidores(id),
        SeguidorPet.contarSeguindo(pet.usuario_id),
        uid ? SeguidorPet.estaSeguindo(uid, id) : false,
        PetPetshopLink.listarPorPet(id),
      ]);
      const dono = await Usuario.buscarPorId(pet.usuario_id);
      const petshopsVinculadosComFollow = await Promise.all(
        (petshopsVinculados || []).map(async (item) => ({
          ...item,
          usuario_segue: uid ? await PetshopFollower.usuarioSegue(item.petshop_id, uid) : false,
        }))
      );

      const edicaoFof = await PetDoMes.buscarOuCriarEdicaoAtiva();
      const eligPet = await petsMaisFofinhosEligibility.detalheElegibilidadePet(id);
      let petsMaisFofinhos = null;
      if (edicaoFof) {
        const viewerU = uid ? await Usuario.buscarPorId(uid) : null;
        const posNacional = eligPet.elegivel
          ? await PetDoMes.posicaoPetNoRanking(edicaoFof.id, id, 'nacional', viewerU || {})
          : null;
        let diasRestantes = null;
        if (edicaoFof.termina_em) {
          const ms = new Date(edicaoFof.termina_em).getTime() - Date.now();
          diasRestantes = Math.max(0, Math.ceil(ms / 86400000));
        }
        petsMaisFofinhos = {
          edicao: edicaoFof,
          elegivel: eligPet.elegivel,
          fotosComMidia: eligPet.fotosComMidia,
          temPetshop: eligPet.temPetshop,
          minFotos: petsMaisFofinhosEligibility.MIN_POSTS_COM_MIDIA,
          posicaoNacional: posNacional,
          diasRestantes,
        };
      }

      res.render('explorar/perfil-pet', {
        titulo: pet.nome,
        pet,
        dono,
        posts,
        totalSeguidores,
        totalSeguindo,
        estaSeguindo,
        eMeuPet: uid === pet.usuario_id,
        petshopsVinculados: petshopsVinculadosComFollow,
        petsMaisFofinhos,
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no perfil do pet', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar perfil.' };
      res.redirect('/explorar');
    }
  },

  async perfilPublico(req, res) {
    try {
      const { id } = req.params;
      const uid = usuarioAtor(req) ? usuarioAtor(req).id : null;
      const usuario = await Usuario.buscarPorId(id);

      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/explorar');
      }

      const [pets, totalPosts] = await Promise.all([
        Pet.buscarPorUsuario(id),
        Publicacao.contarAtivas(id),
      ]);

      /*
       * "Fotos dos pets" agora vem do sistema de posts (publicacoes).
       * Para cada pet, carregamos os posts mais recentes que tenham midia
       * e montamos um grid agrupado por pet. Reusa o modal de detalhe.
       */
      let galeriaPorPetLista = [];
      try {
        const POSTS_POR_PET = 9;
        const porPet = await Promise.all((pets || []).map(async (p) => {
          const lista = await Publicacao.buscarPorPet(p.id, uid, POSTS_POR_PET);
          const comFoto = (lista || [])
            .filter((post) => post && post.foto && String(post.foto).trim())
            .map((post) => ({ id: post.id, foto: post.foto }));
          if (!comFoto.length) return null;
          return {
            pet_id: p.id,
            pet_nome: p.nome,
            pet_slug: p.slug,
            pet_foto: p.foto,
            tem_tag_ativa: !!p.tem_tag_ativa,
            verificado: !!p.verificado,
            fotos: comFoto,
          };
        }));
        galeriaPorPetLista = porPet.filter(Boolean);
      } catch (e) {
        logger.error('EXPLORAR', 'Erro ao montar galeria-de-posts do perfil', e);
        galeriaPorPetLista = [];
      }

      res.render('explorar/perfil', {
        titulo: usuario.nome,
        perfil: usuario,
        posts: [],
        pets,
        seguidores: 0,
        seguindo: 0,
        estaSeguindo: false,
        eMeuPerfil: uid === parseInt(id),
        perfilTab: 'posts',
        totalPosts: totalPosts || 0,
        totalFixadas: 0,
        soPets: true,
        galeriaPorPet: galeriaPorPetLista,
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no perfil público', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar perfil.' };
      res.redirect('/explorar');
    }
  },

  async buscarUsuarios(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      const { q, seguindo } = req.query;
      const somenteSeguindo = seguindo === '1' && uid;

      if (somenteSeguindo) {
        const termo = (q || '').trim().toLowerCase();
        const rows = await Seguidor.listarSeguidosParaMencao(uid, termo.length >= 1 ? termo : null, 15);
        return res.json(rows);
      }

      if (!q || q.length < 2) return res.json([]);
      const rows = await Usuario.buscarBasicoPorNomeLike(`%${q.toLowerCase()}%`, 10);
      res.json(rows);
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao buscar usuários', err);
      res.json([]);
    }
  },

  async buscarUsuariosV2(req, res) {
    try {
      const q = String(req.query.q || '').replace(/^@/, '').trim().toLowerCase();
      const uid = req.session?.usuario?.id;
      if (!q || q.length < 1) return res.json({ sucesso: true, usuarios: [] });
      const usuarios = await Usuario.buscarParaMencaoAutocomplete(q, uid, 10);
      res.json({ sucesso: true, usuarios });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro busca usuários v2', err);
      res.status(500).json({ sucesso: false, usuarios: [] });
    }
  },

  async criarPostV2(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Faça login para publicar.' });

      const texto = String(req.body?.text || req.body?.texto || '').trim();
      const petId = req.body?.pet_id ? parseInt(req.body.pet_id, 10) : null;
      const taggedUserIds = Array.isArray(req.body?.taggedUserIds) ? req.body.taggedUserIds : [];

      const mediaFiles = Array.isArray(req.files) ? req.files : [];
      if (!texto && mediaFiles.length === 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva algo ou envie mídia.' });
      }
      await validarPetDonoOuFalhar(petId, uid, 'Pet inválido para publicação.', { obrigatorio: true });

      const idempotencyKey = String(req.get('Idempotency-Key') || req.get('X-Idempotency-Key') || '').trim().slice(0, 120);
      const requestHash = buildPostRequestHash({
        texto,
        pet_id: petId || null,
        media: mediaFiles.map((f) => `${f.originalname}:${f.size}`).join('|'),
      });
      const idem = await tryGetIdempotentResponse(uid, idempotencyKey, requestHash);
      if (idem) return res.status(idem.status).json(idem.payload);

      const ultimo = await Publicacao.ultimoPostDoUsuario(uid);
      if (ultimo && (Date.now() - new Date(ultimo.criado_em).getTime()) < 3000) {
        const payload = { sucesso: false, mensagem: 'Aguarde alguns segundos antes de publicar novamente.' };
        await saveIdempotentResponse(uid, idempotencyKey, requestHash, 429, payload);
        return res.status(429).json(payload);
      }
      const repetido = await Publicacao.buscarRecenteIgual(uid, texto, petId || null, 15);
      if (repetido) {
        const postExistente = await Publicacao.buscarPorId(repetido.id, uid);
        const totalPostsExistente = await Publicacao.contarAtivas(uid);
        const payload = { sucesso: true, post: postExistente, totalPosts: totalPostsExistente, removido: null, duplicado: true };
        await saveIdempotentResponse(uid, idempotencyKey, requestHash, 200, payload);
        return res.json(payload);
      }

      const removido = await autoDeleteSeNecessario(uid);

      const rawMolduraV2 = req.body?.fofinhos_moldura;
      const querMolduraV2 =
        rawMolduraV2 === true || rawMolduraV2 === 1 || rawMolduraV2 === '1' || rawMolduraV2 === 'true';
      let fofinhosMolduraV2 = false;
      if (querMolduraV2 && petId) {
        const detV2 = await petsMaisFofinhosEligibility.detalheElegibilidadePet(petId);
        fofinhosMolduraV2 = !!detV2.elegivel;
      }

      const post = await Publicacao.criar({
        usuario_id: uid,
        pet_id: petId || null,
        foto: mediaFiles[0] ? multerPublicUrl(mediaFiles[0], 'posts') : null,
        legenda: texto || null,
        texto: texto || null,
        fofinhos_moldura: fofinhosMolduraV2,
      });
      for (let i = 0; i < mediaFiles.length; i += 1) {
        const f = mediaFiles[i];
        const urlMidia = multerPublicUrl(f, 'posts');
        if (urlMidia) await PostMedia.criar(post.id, urlMidia, 'image', i, 'ready');
      }

      const nomesMencionados = PostMention.extrairMencoes(texto);
      const usuariosMencionados = await PostMention.resolverUsuariosPorNome(nomesMencionados);
      await PostMention.criarEmLote(post.id, uid, usuariosMencionados.map((u) => u.id));
      await notificarMencoes(texto, uid, post.id, 'publicacao');

      const tags = await PostTag.criarPendentes(post.id, uid, taggedUserIds);
      const svc = getNotificacaoService();
      if (svc && tags.length) {
        const autor = await Usuario.buscarPorId(uid);
        for (const t of tags) {
          if (t.tagged_user_id === uid) continue;
          svc.criar(
            t.tagged_user_id,
            'tag_post',
            `${autor.nome} marcou você em uma publicação.`,
            `/explorar#post-${post.id}`,
            { remetente_id: uid, publicacao_id: post.id }
          ).catch(() => {});
        }
      }

      await socialPostHooks.aposCriarPublicacao({
        postId: post.id,
        petId: petId || null,
        autorUserId: uid,
        texto: texto || null,
        legenda: texto || null,
        lat: req.body?.lat,
        lng: req.body?.lng,
        local_nome: req.body?.local_nome,
      });

      const completo = await Publicacao.buscarPorId(post.id, uid);
      const payload = {
        sucesso: true,
        post: completo,
        totalPosts: await Publicacao.contarAtivas(uid),
        removido: removido ? removido.id : null,
        media_count: mediaFiles.length,
        mentions_count: usuariosMencionados.length,
        tags_pending: tags.length,
      };
      await saveIdempotentResponse(uid, idempotencyKey, requestHash, 200, payload);
      return res.json(payload);
    } catch (err) {
      if (err && err.code === 'PET_ID_OBRIGATORIO') {
        return res.status(400).json({ sucesso: false, mensagem: err.message || 'Escolha um pet para publicar.' });
      }
      if (err && err.code === 'PET_NAO_PERTENCE') {
        return res.status(400).json({ sucesso: false, mensagem: err.message || 'Pet inválido para publicação.' });
      }
      logger.error('EXPLORAR', 'Erro criar post v2', err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao publicar.' });
    }
  },

  async feedV2(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
      const beforeId = req.query.cursor ? parseInt(req.query.cursor, 10) : null;
      const posts = await Publicacao.feedPorCursor(uid, limit, beforeId);
      const nextCursor = posts.length ? posts[posts.length - 1].id : null;
      return res.json({ sucesso: true, posts, next_cursor: nextCursor });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro feed v2', err);
      return res.status(500).json({ sucesso: false, posts: [] });
    }
  },

  async comentarV2(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
      const postId = parseInt(req.params.id, 10);
      const texto = String(req.body?.texto || req.body?.text || '').trim();
      const parentRaw = req.body?.parent_id ?? req.body?.parentId;
      if (!postId || !texto) return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.' });
      let novo;
      try {
        novo = await Comentario.criar({ usuario_id: uid, publicacao_id: postId, texto, parent_id: parentRaw });
      } catch (e) {
        if (e && e.code === 'COMMENT_INVALID_PARENT') {
          return res.status(400).json({ sucesso: false, mensagem: 'Resposta inválida.' });
        }
        throw e;
      }
      const nomes = PostMention.extrairMencoes(texto);
      const usuarios = await PostMention.resolverUsuariosPorNome(nomes);
      await CommentMention.criarEmLote(novo.id, uid, usuarios.map((u) => u.id));
      await notificarMencoes(texto, uid, postId, 'comentario');

      const svc = getNotificacaoService();
      const post = await Publicacao.buscarPorId(postId);
      const autor = await Usuario.buscarPorId(uid);
      if (svc && post) {
        if (!novo.parent_id && post.usuario_id !== uid) {
          svc.criar(post.usuario_id, 'comentario', `${autor.nome} comentou na sua publicação.`, `/explorar#post-${postId}`, { remetente_id: uid, publicacao_id: postId, pet_id: post.pet_id || null }).catch(() => {});
        }
        if (novo.parent_id) {
          const pai = await Comentario.buscarPorId(novo.parent_id);
          if (pai && pai.usuario_id !== uid) {
            svc.criar(
              pai.usuario_id,
              'comentario',
              `${autor.nome} respondeu ao seu comentário.`,
              `/explorar#post-${postId}`,
              { remetente_id: uid, publicacao_id: postId, pet_id: post.pet_id || null }
            ).catch(() => {});
          }
        }
      }

      return res.json({ sucesso: true, comentario: novo });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro comentar v2', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async responderTagPost(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
      const tagId = parseInt(req.body?.tagId || req.params?.id, 10);
      const action = String(req.body?.action || '').trim().toLowerCase();
      if (!tagId || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Ação inválida.' });
      }
      const resultado = await PostTag.responder(tagId, uid, action);
      if (!resultado) return res.status(404).json({ sucesso: false, mensagem: 'Marcação pendente não encontrada.' });
      const svc = getNotificacaoService();
      if (svc && resultado.tagged_by_user_id && resultado.tagged_by_user_id !== uid) {
        const eu = await Usuario.buscarPorId(uid);
        const acaoTxt = action === 'approve' ? 'aceitou' : 'recusou';
        svc.criar(
          resultado.tagged_by_user_id,
          'tag_post_resposta',
          `${eu.nome} ${acaoTxt} a marcação na publicação.`,
          `/explorar#post-${resultado.post_id}`,
          { remetente_id: uid, publicacao_id: resultado.post_id }
        ).catch(() => {});
      }
      return res.json({ sucesso: true, tag: resultado });
    } catch (err) {
      if (err.code === 'TAG_LIMIT') {
        return res.status(409).json({ sucesso: false, mensagem: err.message });
      }
      logger.error('EXPLORAR', 'Erro responder tag', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async minhasMarcacoes(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
      const posts = await PostTag.listarAprovados(uid, 50);
      return res.json({ sucesso: true, posts });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro minhas marcações', err);
      return res.status(500).json({ sucesso: false, posts: [] });
    }
  },

  async minhasMarcacoesPendentes(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
      const pendentes = await PostTag.listarPendentes(uid, 50);
      return res.json({ sucesso: true, pendentes });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro marcações pendentes', err);
      return res.status(500).json({ sucesso: false, pendentes: [] });
    }
  },

  async seguirPet(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const pet = await Pet.buscarPorId(id);
      await SeguidorPet.seguir(uid, id);
      const total = await SeguidorPet.contarSeguidores(id);
      if (pet && pet.usuario_id !== uid) {
        const svc = getNotificacaoService();
        if (svc) {
          const autor = await Usuario.buscarPorId(uid);
          svc.criar(pet.usuario_id, 'seguidor', `${autor.nome} começou a seguir ${pet.nome}.`, `/explorar/pet/${id}`, { remetente_id: uid, pet_id: parseInt(id) }).catch(() => {});
        }
      }
      res.json({ sucesso: true, seguindo: true, totalSeguidores: total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao seguir pet', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async deixarDeSeguirPet(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      await SeguidorPet.deixarDeSeguir(uid, id);
      const total = await SeguidorPet.contarSeguidores(id);
      res.json({ sucesso: true, seguindo: false, totalSeguidores: total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao deixar de seguir pet', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async vincularPetshop(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      const petId = parseInt(req.params.id, 10);
      const petshopId = parseInt(req.body?.petshop_id, 10);
      const tipo = String(req.body?.tipo_vinculo || 'cliente');
      const principal = req.body?.principal === true || req.body?.principal === 'true' || req.body?.principal === '1';
      const usoFrequente = req.body?.uso_frequente === true || req.body?.uso_frequente === 'true' || req.body?.uso_frequente === '1';
      const atendimentoRealizado = req.body?.atendimento_realizado === true || req.body?.atendimento_realizado === 'true' || req.body?.atendimento_realizado === '1';
      const cadastroNoPetshop = req.body?.cadastro_no_petshop === true || req.body?.cadastro_no_petshop === 'true' || req.body?.cadastro_no_petshop === '1';
      if (!petId || !petshopId) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.' });
      }
      const pet = await Pet.buscarPorId(petId);
      if (!pet || pet.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Você não pode vincular este pet.' });
      }
      const scoreBase = (principal ? 100 : 0) + (usoFrequente ? 30 : 0) + (atendimentoRealizado ? 25 : 0) + (cadastroNoPetshop ? 20 : 0);
      await PetPetshopLink.vincular({
        pet_id: petId,
        petshop_id: petshopId,
        tipo_vinculo: tipo,
        principal,
        relevance_score: scoreBase,
      });
      const links = await PetPetshopLink.listarPorPet(petId);
      return res.json({ sucesso: true, links });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao vincular petshop ao pet', err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao vincular petshop.' });
    }
  },

  async desvincularPetshop(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      const petId = parseInt(req.params.id, 10);
      const petshopId = parseInt(req.params.petshopId, 10);
      const pet = await Pet.buscarPorId(petId);
      if (!pet || pet.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Você não pode desvincular este pet.' });
      }
      await PetPetshopLink.desvincular(petId, petshopId);
      const links = await PetPetshopLink.listarPorPet(petId);
      return res.json({ sucesso: true, links });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao desvincular petshop do pet', err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao desvincular petshop.' });
    }
  },

  async atualizarCapaPet(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      const petId = parseInt(req.params.id, 10);
      if (!uid || !petId) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.' });
      }
      const pet = await Pet.buscarPorId(petId);
      if (!pet || pet.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão para atualizar capa deste pet.' });
      }
      if (!req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Envie uma imagem para a capa.' });
      }
      const capaPath = multerPublicUrl(req.file, 'pets/capa');
      const atualizado = await Pet.atualizarCapa(petId, capaPath);
      return res.json({ sucesso: true, foto_capa: atualizado ? atualizado.foto_capa : capaPath });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao atualizar capa do pet', err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar capa.' });
    }
  },

  async removerSeguidorPet(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id: petId, usuarioId } = req.params;
      const pet = await Pet.buscarPorId(petId);
      if (!pet || pet.usuario_id !== uid) {
        return res.status(403).json({ sucesso: false, mensagem: 'Você não pode remover seguidores deste pet.' });
      }
      const seguidorId = parseInt(usuarioId, 10);
      if (!seguidorId) {
        return res.status(400).json({ sucesso: false, mensagem: 'Usuário inválido.' });
      }
      await SeguidorPet.deixarDeSeguir(seguidorId, petId);
      const total = await SeguidorPet.contarSeguidores(petId);
      res.json({ sucesso: true, totalSeguidores: total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao remover seguidor do pet', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async listarSeguidoresPet(req, res) {
    try {
      const { id } = req.params;
      const lista = await SeguidorPet.listarSeguidores(id, 100);
      res.json({ lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar seguidores do pet', err);
      res.status(500).json({ lista: [] });
    }
  },

  async listarSeguindoPet(req, res) {
    try {
      const { id } = req.params;
      const pet = await Pet.buscarPorId(id);
      if (!pet) return res.json({ lista: [] });
      const lista = await SeguidorPet.listarPetsSeguidos(pet.usuario_id, 100);
      res.json({ lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar seguindo do pet', err);
      res.status(500).json({ lista: [] });
    }
  },

  async listarSeguidoresUsuario(req, res) {
    try {
      const { id } = req.params;
      const lista = await Seguidor.listarSeguidores(id, 100);
      res.json({ lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar seguidores', err);
      res.status(500).json({ lista: [] });
    }
  },

  async listarSeguindoUsuario(req, res) {
    try {
      const { id } = req.params;
      const lista = await Seguidor.listarSeguindo(id, 100);
      res.json({ lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar seguindo', err);
      res.status(500).json({ lista: [] });
    }
  },

  async buscarPets(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { q } = req.query;
      if (!q || q.length < 2) return res.json([]);
      const resultados = await recomendacaoService.buscarPets(q, uid, 20);
      res.json(resultados);
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao buscar pets', err);
      res.json([]);
    }
  },

  async petsProximosPost(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const { id } = req.params;
      const post = await Publicacao.buscarPorId(id);
      if (!post) return res.status(404).json({ lista: [] });
      const lista = await recomendacaoService.petsProximos(post.usuario_id, uid, 8);
      res.json({ lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar pets próximos', err);
      res.status(500).json({ lista: [] });
    }
  },

  async registrarVisualizacao(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false });

      const usuario = await Usuario.buscarPorId(uid);
      if (!usuario) {
        logger.warn('EXPLORAR', `Sessão com usuário inexistente (id: ${uid}). Possível usuário excluído.`);
        return res.status(401).json({ sucesso: false, mensagem: 'Sessão inválida. Faça login novamente.' });
      }

      const postId = parseInt(req.body?.postId, 10);
      const watchMs = Math.max(0, parseInt(req.body?.watchMs || '0', 10) || 0);
      const city = typeof req.body?.city === 'string' ? req.body.city.trim().slice(0, 100) : null;
      const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 30) : 'feed';

      if (!postId) {
        return res.status(400).json({ sucesso: false, mensagem: 'postId inválido.' });
      }

      const registro = await PostInteractionRaw.registrarVisualizacaoUnica({
        userId: uid,
        postId,
        watchMs,
        city,
        metadata: { source },
      });

      return res.json({ sucesso: true, view_contabilizada: Boolean(registro && registro.inserido) });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao registrar visualização', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async petDoMesPagina(req, res) {
    try {
      const ator = usuarioAtor(req);
      if (!ator || !ator.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Faça login para ver Pets mais fofinhos.' };
        return res.redirect('/auth/login?return_to=/explorar/pet-do-mes');
      }
      const uid = ator.id;
      const viewer = await Usuario.buscarPorId(uid);
      const nivel = String(req.query.nivel || 'nacional').toLowerCase();
      const nivelSeguro = ['bairro', 'cidade', 'estado', 'pais', 'nacional'].includes(nivel) ? nivel : 'nacional';

      const edicao = await PetDoMes.buscarOuCriarEdicaoAtiva();
      if (!edicao) {
        req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível carregar a edição do concurso.' };
        return res.redirect('/explorar');
      }

      const rankingCapas = await PetDoMes.listarRankingComCapaPorNivel(edicao.id, nivelSeguro, viewer || {}, 24);
      const linhas = await Promise.all(
        rankingCapas.map(async (r) => {
          const pet = await Pet.buscarPorId(r.pet_id);
          return pet ? { pet_id: r.pet_id, votos: r.votos, media_url: r.media_url, pet } : null;
        })
      );

      const meu = await PetDoMes.usuarioVoto(edicao.id, uid);
      const meusPets = await Pet.buscarPorUsuario(uid);
      const seguidos = await SeguidorPet.listarPetsSeguidos(uid, 80);
      const vistos = new Set();
      const petsCandidatos = [];
      (meusPets || []).forEach((p) => {
        if (p && !vistos.has(p.id)) {
          vistos.add(p.id);
          petsCandidatos.push(p);
        }
      });
      (seguidos || []).forEach((row) => {
        const idPet = row.id;
        if (idPet && !vistos.has(idPet)) {
          vistos.add(idPet);
          petsCandidatos.push({
            id: idPet,
            nome: row.nome,
            foto: row.foto,
            slug: row.slug || null,
            usuario_id: row.dono_id,
          });
        }
      });
      const idsVoto = petsCandidatos.map((p) => p.id).filter(Boolean);
      const elegiveisSet = await petsMaisFofinhosEligibility.petsElegiveisIds(idsVoto);
      const pets = petsCandidatos.filter((p) => elegiveisSet.has(p.id));

      let diasRestantes = null;
      if (edicao.termina_em) {
        const ms = new Date(edicao.termina_em).getTime() - Date.now();
        diasRestantes = Math.max(0, Math.ceil(ms / 86400000));
      }

      const posicaoMeuVoto =
        meu && meu.pet_id
          ? await PetDoMes.posicaoPetNoRanking(edicao.id, meu.pet_id, nivelSeguro, viewer || {})
          : null;

      res.render('explorar/pet-do-mes', {
        titulo: 'Pets mais fofinhos',
        edicao,
        nivelAtual: nivelSeguro,
        ranking: linhas.filter(Boolean),
        meuVotoPetId: meu ? meu.pet_id : null,
        posicaoMeuVoto,
        pets,
        diasRestantes,
        viewerTemGeo: {
          bairro: !!(viewer && String(viewer.bairro || '').trim()),
          cidade: !!(viewer && String(viewer.cidade || '').trim()),
          estado: !!(viewer && String(viewer.estado || '').trim()),
          pais: !!(viewer && String(viewer.pais || '').trim()),
        },
      });
    } catch (err) {
      logger.error('EXPLORAR', 'pet do mês', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar Pets mais fofinhos.' };
      res.redirect('/explorar');
    }
  },

  async petDoMesVotar(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Faça login.' });
      const petId = parseInt(req.body?.pet_id, 10);
      if (!petId) return res.status(400).json({ sucesso: false, mensagem: 'Escolha um pet.' });
      const pet = await Pet.buscarPorId(petId);
      if (!pet) return res.status(400).json({ sucesso: false, mensagem: 'Pet inválido.' });

      const elig = await petsMaisFofinhosEligibility.detalheElegibilidadePet(petId);
      if (!elig.elegivel) {
        return res.status(400).json({
          sucesso: false,
          mensagem:
            'Este pet só recebe votos no concurso com 4+ posts com foto e vínculo ativo com petshop.',
        });
      }

      const dono = parseInt(pet.usuario_id, 10) === parseInt(uid, 10);
      const segue = dono ? true : await SeguidorPet.estaSeguindo(uid, petId);
      if (!segue) {
        return res.status(403).json({ sucesso: false, mensagem: 'Vote apenas em pets que você segue ou seus próprios pets.' });
      }
      const edicao = await PetDoMes.buscarOuCriarEdicaoAtiva();
      if (!edicao || edicao.estado !== 'aberta') {
        return res.status(400).json({ sucesso: false, mensagem: 'Votação encerrada.' });
      }
      if (edicao.termina_em && new Date(edicao.termina_em).getTime() < Date.now()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Esta edição já terminou.' });
      }
      await PetDoMes.votar(edicao.id, petId, uid);
      return res.json({ sucesso: true });
    } catch (err) {
      logger.error('EXPLORAR', 'voto pet do mês', err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao registrar voto.' });
    }
  },

  async storiesSeguidos(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
      const stories = await Story.listarAtivosParaPetsSeguidos(uid, 40);
      return res.json({ sucesso: true, stories });
    } catch (err) {
      logger.error('EXPLORAR', 'stories', err);
      return res.status(500).json({ sucesso: false, stories: [] });
    }
  },

  async criarStory(req, res) {
    try {
      const uid = req.session?.usuario?.id;
      if (!uid) return res.status(401).json({ sucesso: false, mensagem: 'Faça login.' });
      const petId = req.body?.pet_id ? parseInt(req.body.pet_id, 10) : null;
      const foto = multerPublicUrl(req.file, 'posts');
      if (!foto) return res.status(400).json({ sucesso: false, mensagem: 'Envie uma imagem.' });
      await validarPetDonoOuFalhar(petId, uid, 'Pet inválido.', { obrigatorio: true });
      const legenda = req.body?.legenda != null ? String(req.body.legenda).trim().slice(0, 280) : null;
      const story = await Story.criar({
        pet_id: petId,
        autor_user_id: uid,
        media_url: foto,
        media_type: 'image',
        legenda: legenda || null,
      });
      return res.json({ sucesso: true, story });
    } catch (err) {
      if (err && err.code === 'LIMITE_STORIES') {
        return res.status(429).json({ sucesso: false, mensagem: 'Limite de stories nas últimas 24h para este pet.' });
      }
      if (err && err.code === 'PET_ID_OBRIGATORIO') {
        return res.status(400).json({ sucesso: false, mensagem: err.message || 'Escolha um pet.' });
      }
      if (err && err.code === 'PET_NAO_PERTENCE') {
        return res.status(400).json({ sucesso: false, mensagem: err.message || 'Pet inválido.' });
      }
      logger.error('EXPLORAR', 'criar story', err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao publicar story.' });
    }
  },

  async paginaBusca(req, res) {
    try {
      const uid = usuarioAtor(req).id;
      const q = req.query.q || '';
      let resultadosPets = [];
      let resultadosUsuarios = [];

      if (q.length >= 2) {
        const [petsR, usersR] = await Promise.all([
          recomendacaoService.buscarPets(q, uid, 20),
          Usuario.buscarParaPaginaBuscaExplorar(`%${q.toLowerCase()}%`, uid, 20),
        ]);
        resultadosPets = petsR;
        resultadosUsuarios = usersR;
      }

      const [recomendacoes, petsRecomendados] = await Promise.all([
        recomendacaoService.recomendarPessoas(uid, 8).catch(() => []),
        recomendacaoService.petsRecomendados(uid, 8).catch(() => []),
      ]);

      res.render('explorar/busca', {
        titulo: 'Buscar',
        q,
        resultadosPets,
        resultadosUsuarios,
        recomendacoes,
        petsRecomendados,
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro na busca', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao buscar.' };
      res.redirect('/explorar');
    }
  },
};

module.exports = explorarController;
