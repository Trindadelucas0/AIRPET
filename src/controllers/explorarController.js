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
const recomendacaoService = require('../services/recomendacaoService');
const logger = require('../utils/logger');
const { query } = require('../config/database');

function getNotificacaoService() {
  try { return require('../services/notificacaoService'); } catch (_) { return null; }
}

async function notificarMencoes(texto, autorId, publicacaoId) {
  const nomes = Comentario.extrairMencoes(texto);
  if (!nomes.length) return;
  const usuarios = await Comentario.resolverMencoes(nomes);
  const svc = getNotificacaoService();
  if (!svc) return;
  const autor = await Usuario.buscarPorId(autorId);
  for (const u of usuarios) {
    if (u.id === autorId) continue;
    try {
      await svc.criar(u.id, 'mencao', `${autor.nome} mencionou você em um comentário.`, `/explorar#post-${publicacaoId}`, { remetente_id: autorId, publicacao_id: publicacaoId });
    } catch (_) {}
  }
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

const FotoPerfilPet = require('../models/FotoPerfilPet');

const explorarController = {

  async feedSeguidos(req, res) {
    try {
      const uid = req.session.usuario.id;
      const page = parseInt(req.query.page) || 1;
      const limite = 20;
      const offset = (page - 1) * limite;

      const postsOrganicos = await Publicacao.feedSeguindoPets(uid, limite, offset);
      const patrocinados = await Publicacao.buscarPatrocinadosPetAtivos(uid, 8);
      const posts = mesclarPostsComPatrocinados(postsOrganicos, patrocinados, page);

      const [pets, totalPosts, totalFixadas, recomendacoes, petsRecomendados] = await Promise.all([
        Pet.buscarPorUsuario(uid),
        Publicacao.contarAtivas(uid),
        Publicacao.contarFixadas(uid),
        page === 1 ? recomendacaoService.recomendarPessoas(uid, 6).catch(() => []) : [],
        page === 1 ? recomendacaoService.petsRecomendados(uid, 8).catch(() => []) : [],
      ]);

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ sucesso: true, posts, totalPosts, totalFixadas });
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
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no feed de seguidos', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o feed.' };
      res.redirect('/pets');
    }
  },

  async feed(req, res) {
    try {
      const uid = req.session.usuario.id;
      const page = parseInt(req.query.page) || 1;
      const limite = 20;
      const offset = (page - 1) * limite;

      let postsOrganicos = await Publicacao.feedRegional(uid, limite, offset);

      if (postsOrganicos.length < 5) {
        const cidadePosts = await Publicacao.feedRegionalCidade(uid, limite - postsOrganicos.length, 0);
        const idsJaTem = new Set(postsOrganicos.map(p => p.id));
        for (const p of cidadePosts) {
          if (!idsJaTem.has(p.id)) postsOrganicos.push(p);
        }
      }

      if (postsOrganicos.length === 0) {
        postsOrganicos = await Publicacao.feedGeral(limite, offset, uid);
      }

      const patrocinados = await Publicacao.buscarPatrocinadosPetAtivos(uid, 8);
      const posts = mesclarPostsComPatrocinados(postsOrganicos, patrocinados, page);

      const [pets, totalPosts, totalFixadas, recomendacoes, petsRecomendados] = await Promise.all([
        Pet.buscarPorUsuario(uid),
        Publicacao.contarAtivas(uid),
        Publicacao.contarFixadas(uid),
        page === 1 ? recomendacaoService.recomendarPessoas(uid, 6).catch(() => []) : [],
        page === 1 ? recomendacaoService.petsRecomendados(uid, 8).catch(() => []) : [],
      ]);

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ sucesso: true, posts, totalPosts, totalFixadas });
      }

      res.render('explorar', {
        titulo: 'Explorar',
        posts,
        page,
        pets,
        totalPosts,
        totalFixadas,
        temMais: postsOrganicos.length === limite,
        recomendacoes,
        petsRecomendados,
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no feed regional', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o explorar.' };
      res.redirect('/pets');
    }
  },

  async criarPost(req, res) {
    try {
      const uid = req.session.usuario?.id;
      if (!uid) {
        return res.status(401).json({ sucesso: false, mensagem: 'Faça login para publicar.' });
      }
      const { texto, pet_id } = req.body || {};
      const foto = req.file ? `/images/posts/${req.file.filename}` : null;

      if (!foto) {
        return res.status(400).json({ sucesso: false, mensagem: 'Envie uma foto.' });
      }
      if (!texto || !String(texto).trim()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva uma legenda.' });
      }
      const petId = pet_id ? parseInt(pet_id, 10) : null;
      if (petId) {
        const pet = await Pet.buscarPorId(petId);
        if (!pet || pet.usuario_id !== uid) {
          return res.status(400).json({ sucesso: false, mensagem: 'Pet não encontrado ou você não é o dono.' });
        }
      }

      const removido = await autoDeleteSeNecessario(uid);

      const post = await Publicacao.criar({
        usuario_id: uid, pet_id: petId || null, foto, legenda: String(texto).trim(), texto: String(texto).trim(),
      });
      const completo = await Publicacao.buscarPorId(post.id, uid);
      const totalPosts = await Publicacao.contarAtivas(uid);

      res.json({ sucesso: true, post: completo, totalPosts, removido: removido ? removido.id : null });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao criar post', err);
      const msg = process.env.NODE_ENV === 'production'
        ? 'Erro ao publicar. Tente novamente.'
        : (err.message || 'Erro ao publicar.');
      res.status(500).json({ sucesso: false, mensagem: msg });
    }
  },

  async repostar(req, res) {
    try {
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
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
      const lista = await Comentario.buscarPorPublicacao(id);
      res.json({ sucesso: true, comentarios: lista });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao listar comentários', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async comentar(req, res) {
    try {
      const uid = req.session.usuario.id;
      const { id } = req.params;
      const { texto } = req.body;

      if (!texto || !texto.trim()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva algo.' });
      }

      await Comentario.criar({ usuario_id: uid, publicacao_id: id, texto: texto.trim() });

      notificarMencoes(texto.trim(), uid, id).catch(() => {});

      const svc = getNotificacaoService();
      if (svc) {
        const post = await Publicacao.buscarPorId(id);
        if (post && post.usuario_id !== uid) {
          const autor = await Usuario.buscarPorId(uid);
          svc.criar(post.usuario_id, 'comentario', `${autor.nome} comentou na sua publicação.`, `/explorar#post-${id}`, { remetente_id: uid, publicacao_id: parseInt(id), pet_id: post.pet_id || null }).catch(() => {});
        }
      }

      const lista = await Comentario.buscarPorPublicacao(id);
      res.json({ sucesso: true, comentarios: lista, total: lista.length });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao comentar', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async deletarComentario(req, res) {
    try {
      const uid = req.session.usuario.id;
      const { id } = req.params;
      const { query: dbQuery } = require('../config/database');
      const check = await dbQuery('SELECT * FROM comentarios WHERE id = $1', [id]);
      if (!check.rows[0] || check.rows[0].usuario_id !== uid) {
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
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
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
      res.status(500).json({ sucesso: false });
    }
  },

  async seguir(req, res) {
    try {
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario ? req.session.usuario.id : null;
      const pet = await Pet.buscarPorId(id);
      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/explorar');
      }
      const posts = await Publicacao.buscarPorPet(id, uid, 50);
      const [totalSeguidores, totalSeguindo, estaSeguindo] = await Promise.all([
        SeguidorPet.contarSeguidores(id),
        SeguidorPet.contarSeguindo(pet.usuario_id),
        uid ? SeguidorPet.estaSeguindo(uid, id) : false,
      ]);
      const dono = await Usuario.buscarPorId(pet.usuario_id);
      res.render('explorar/perfil-pet', {
        titulo: pet.nome,
        pet,
        dono,
        posts,
        totalSeguidores,
        totalSeguindo,
        estaSeguindo,
        eMeuPet: uid === pet.usuario_id,
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
      const uid = req.session.usuario ? req.session.usuario.id : null;
      const usuario = await Usuario.buscarPorId(id);

      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/explorar');
      }

      const [pets, galeriaLinhas] = await Promise.all([
        Pet.buscarPorUsuario(id),
        FotoPerfilPet.listarPorUsuario(id),
      ]);

      const galeriaPorPet = {};
      (galeriaLinhas || []).forEach((f) => {
        if (!galeriaPorPet[f.pet_id]) galeriaPorPet[f.pet_id] = { pet_nome: f.pet_nome, pet_foto: f.pet_foto, fotos: [] };
        galeriaPorPet[f.pet_id].fotos.push({ id: f.id, foto: f.foto });
      });
      const galeriaPorPetLista = Object.entries(galeriaPorPet).map(([pet_id, v]) => ({ pet_id: parseInt(pet_id, 10), pet_nome: v.pet_nome, pet_foto: v.pet_foto, fotos: v.fotos }));

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
        totalPosts: 0,
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
      const { query: dbQuery } = require('../config/database');
      const somenteSeguindo = seguindo === '1' && uid;

      if (somenteSeguindo) {
        // Menções estilo Instagram: só quem eu sigo (digitar @ abre a lista)
        const termo = (q || '').trim().toLowerCase();
        const params = [uid];
        let sql = `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil
          FROM seguidores s
          JOIN usuarios u ON u.id = s.seguido_id
          WHERE s.seguidor_id = $1`;
        if (termo.length >= 1) {
          params.push('%' + termo + '%');
          sql += ` AND LOWER(u.nome) LIKE $2`;
        }
        sql += ` ORDER BY u.nome LIMIT 15`;
        const resultado = await dbQuery(sql, params);
        return res.json(resultado.rows);
      }

      if (!q || q.length < 2) return res.json([]);
      const resultado = await dbQuery(
        `SELECT id, nome, cor_perfil, foto_perfil FROM usuarios WHERE LOWER(nome) LIKE $1 ORDER BY nome LIMIT 10`,
        ['%' + q.toLowerCase() + '%']
      );
      res.json(resultado.rows);
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao buscar usuários', err);
      res.json([]);
    }
  },

  async seguirPet(req, res) {
    try {
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
      const { id } = req.params;
      await SeguidorPet.deixarDeSeguir(uid, id);
      const total = await SeguidorPet.contarSeguidores(id);
      res.json({ sucesso: true, seguindo: false, totalSeguidores: total });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao deixar de seguir pet', err);
      res.status(500).json({ sucesso: false });
    }
  },

  async removerSeguidorPet(req, res) {
    try {
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
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
      const uid = req.session.usuario.id;
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

      const postId = parseInt(req.body?.postId, 10);
      const watchMs = Math.max(0, parseInt(req.body?.watchMs || '0', 10) || 0);
      const city = typeof req.body?.city === 'string' ? req.body.city.trim().slice(0, 100) : null;
      const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 30) : 'feed';

      if (!postId) {
        return res.status(400).json({ sucesso: false, mensagem: 'postId inválido.' });
      }

      await query(
        `INSERT INTO post_interactions_raw
           (user_id, post_id, event_type, watch_ms, city, metadata)
         VALUES
           ($1, $2, 'view', $3, $4, $5::jsonb)`,
        [uid, postId, watchMs, city || null, JSON.stringify({ source })]
      );

      return res.json({ sucesso: true });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao registrar visualização', err);
      return res.status(500).json({ sucesso: false });
    }
  },

  async paginaBusca(req, res) {
    try {
      const uid = req.session.usuario.id;
      const q = req.query.q || '';
      let resultadosPets = [];
      let resultadosUsuarios = [];

      if (q.length >= 2) {
        const { query: dbQuery } = require('../config/database');
        const [petsR, usersR] = await Promise.all([
          recomendacaoService.buscarPets(q, uid, 20),
          dbQuery(
            `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, u.bio, u.cidade, u.bairro,
                    (SELECT COUNT(*)::int FROM seguidores WHERE seguido_id = u.id) AS total_seguidores,
                    (SELECT COUNT(*)::int FROM seguidores WHERE seguidor_id = $2 AND seguido_id = u.id) > 0 AS seguindo
             FROM usuarios u WHERE LOWER(u.nome) LIKE $1 ORDER BY u.nome LIMIT 20`,
            ['%' + q.toLowerCase() + '%', uid]
          ),
        ]);
        resultadosPets = petsR;
        resultadosUsuarios = usersR.rows;
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
