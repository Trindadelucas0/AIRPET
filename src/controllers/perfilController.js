const Usuario = require('../models/Usuario');
const Pet = require('../models/Pet');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const perfilController = {

  async mostrarPerfil(req, res) {
    try {
      const usuario = await Usuario.buscarPorId(req.session.usuario.id);
      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/');
      }

      const pets = await Pet.buscarPorUsuario(usuario.id);

      res.render('perfil', {
        titulo: 'Meu Perfil',
        perfil: usuario,
        pets,
      });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao carregar perfil', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar seu perfil.' };
      res.redirect('/');
    }
  },

  async atualizar(req, res) {
    try {
      const { nome, telefone, cor_perfil, bio, endereco, bairro, cidade, estado, cep } = req.body;
      const id = req.session.usuario.id;

      await Usuario.atualizarPerfil(id, { nome, telefone, cor_perfil: cor_perfil || '#ec5a1c', bio, endereco, bairro, cidade, estado, cep });

      req.session.usuario.nome = nome;
      req.session.usuario.cor_perfil = cor_perfil || '#ec5a1c';

      req.session.flash = { tipo: 'sucesso', mensagem: 'Perfil atualizado com sucesso!' };
      res.redirect('/perfil');
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao atualizar perfil', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar perfil.' };
      res.redirect('/perfil');
    }
  },

  async buscarRacas(req, res) {
    try {
      const { tipo, q } = req.query;
      let sql = 'SELECT id, nome, tipo FROM racas WHERE 1=1';
      const params = [];

      if (tipo) {
        params.push(tipo);
        sql += ` AND tipo = $${params.length}`;
      }
      if (q) {
        params.push('%' + q + '%');
        sql += ` AND LOWER(nome) LIKE LOWER($${params.length})`;
      }

      sql += ' ORDER BY popular DESC, nome ASC LIMIT 50';

      const resultado = await query(sql, params);
      res.json(resultado.rows);
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao buscar raças', erro);
      res.status(500).json([]);
    }
  },
};

module.exports = perfilController;
