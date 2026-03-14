const Publicacao = require('../models/Publicacao');
const Curtida = require('../models/Curtida');
const Comentario = require('../models/Comentario');
const Seguidor = require('../models/Seguidor');
const Pet = require('../models/Pet');
const Usuario = require('../models/Usuario');
const logger = require('../utils/logger');

const explorarController = {

  async feed(req, res) {
    try {
      const uid = req.session.usuario.id;
      const tab = req.query.tab || 'para-voce';
      const page = parseInt(req.query.page) || 1;
      const limite = 20;
      const offset = (page - 1) * limite;

      let posts;
      if (tab === 'seguindo') {
        posts = await Publicacao.feedSeguindo(uid, limite, offset);
      } else {
        posts = await Publicacao.feedGeral(limite, offset, uid);
      }

      const pets = await Pet.buscarPorUsuario(uid);

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ sucesso: true, posts });
      }

      res.render('explorar', {
        titulo: 'Explorar',
        posts,
        tab,
        page,
        pets,
        temMais: posts.length === limite,
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no feed', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o feed.' };
      res.redirect('/pets');
    }
  },

  async criarPost(req, res) {
    try {
      const uid = req.session.usuario.id;
      const { legenda, pet_id } = req.body;
      const foto = req.file ? `/images/posts/${req.file.filename}` : null;

      if (!foto) {
        return res.status(400).json({ sucesso: false, mensagem: 'Envie uma foto.' });
      }

      const post = await Publicacao.criar({ usuario_id: uid, pet_id: pet_id || null, foto, legenda });
      const completo = await Publicacao.buscarPorId(post.id);

      res.json({ sucesso: true, post: completo });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro ao criar post', err);
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao publicar.' });
    }
  },

  async curtir(req, res) {
    try {
      const uid = req.session.usuario.id;
      const { id } = req.params;
      await Curtida.curtir(uid, id);
      const total = await Curtida.contar(id);
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
      const lista = await Comentario.buscarPorPublicacao(id);
      const total = lista.length;
      res.json({ sucesso: true, comentarios: lista, total });
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
      if (fixadas >= 2) {
        return res.status(400).json({ sucesso: false, mensagem: 'Você já tem 2 posts fixados. Desafixe um antes.' });
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

  async perfilPublico(req, res) {
    try {
      const { id } = req.params;
      const uid = req.session.usuario ? req.session.usuario.id : null;
      const usuario = await Usuario.buscarPorId(id);

      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/explorar');
      }

      const [posts, pets, seguidores, seguindo, estaSeguindo] = await Promise.all([
        Publicacao.buscarPorUsuario(id, uid),
        Pet.buscarPorUsuario(id),
        Seguidor.contarSeguidores(id),
        Seguidor.contarSeguindo(id),
        uid ? Seguidor.estaSeguindo(uid, id) : false,
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
      });
    } catch (err) {
      logger.error('EXPLORAR', 'Erro no perfil público', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar perfil.' };
      res.redirect('/explorar');
    }
  },
};

module.exports = explorarController;
