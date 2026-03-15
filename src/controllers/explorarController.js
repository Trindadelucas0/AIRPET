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

const explorarController = {

  async feedSeguidos(req, res) {
    try {
      const uid = req.session.usuario.id;
      const page = parseInt(req.query.page) || 1;
      const limite = 20;
      const offset = (page - 1) * limite;

      const posts = await Publicacao.feedSeguindoPets(uid, limite, offset);

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
        temMais: posts.length === limite,
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

      let posts = await Publicacao.feedRegional(uid, limite, offset);

      if (posts.length < 5) {
        const cidadePosts = await Publicacao.feedRegionalCidade(uid, limite - posts.length, 0);
        const idsJaTem = new Set(posts.map(p => p.id));
        for (const p of cidadePosts) {
          if (!idsJaTem.has(p.id)) posts.push(p);
        }
      }

      if (posts.length === 0) {
        posts = await Publicacao.feedGeral(limite, offset, uid);
      }

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
        temMais: posts.length === limite,
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
      const uid = req.session.usuario.id;
      const { texto, pet_id } = req.body;
      const foto = req.file ? `/images/posts/${req.file.filename}` : null;

      if (!foto) {
        return res.status(400).json({ sucesso: false, mensagem: 'Envie uma foto.' });
      }
      if (!texto || !texto.trim()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Escreva uma legenda.' });
      }

      const removido = await autoDeleteSeNecessario(uid);

      const post = await Publicacao.criar({
        usuario_id: uid, pet_id: pet_id || null, foto, legenda: texto.trim(), texto: texto.trim(),
      });
      const completo = await Publicacao.buscarPorId(post.id, uid);
      const totalPosts = await Publicacao.contarAtivas(uid);

      res.json({ sucesso: true, post: completo, totalPosts, removido: removido ? removido.id : null });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao criar post', err);
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao publicar.' });
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
      const perfilTab = req.query.tab || 'posts';
      const usuario = await Usuario.buscarPorId(id);

      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/explorar');
      }

      let posts;
      if (perfilTab === 'reposts') {
        posts = await Publicacao.buscarRepostsPorUsuario(id, uid);
      } else if (perfilTab === 'curtidas') {
        posts = await Publicacao.buscarCurtidasPorUsuario(id);
      } else {
        posts = await Publicacao.buscarPorUsuario(id, uid);
      }

      const [pets, seguidores, seguindo, estaSeguindo, totalPosts, totalFixadas] = await Promise.all([
        Pet.buscarPorUsuario(id),
        Seguidor.contarSeguidores(id),
        Seguidor.contarSeguindo(id),
        uid ? Seguidor.estaSeguindo(uid, id) : false,
        Publicacao.contarAtivas(id),
        Publicacao.contarFixadas(id),
      ]);

      res.render('explorar/perfil', {
        titulo: usuario.nome,
        perfil: usuario,
        posts,
        pets,
        seguidores,
        seguindo,
        estaSeguindo,
        eMeuPerfil: uid === parseInt(id),
        perfilTab,
        totalPosts,
        totalFixadas,
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no perfil público', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar perfil.' };
      res.redirect('/explorar');
    }
  },

  async buscarUsuarios(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) return res.json([]);
      const { query: dbQuery } = require('../config/database');
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
