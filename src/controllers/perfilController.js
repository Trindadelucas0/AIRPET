const Usuario = require('../models/Usuario');
const Pet = require('../models/Pet');
const FotoPerfilPet = require('../models/FotoPerfilPet');
const path = require('path');
const fs = require('fs');
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
      const id = req.session.usuario.id;
      const body = req.body || {};
      const files = req.files || {};
      const fotoPerfilFile = files.foto_perfil && files.foto_perfil[0];
      const fotoCapaFile = files.foto_capa && files.foto_capa[0];

      const dados = {};
      const camposBody = ['nome', 'telefone', 'cor_perfil', 'bio', 'endereco', 'bairro', 'cidade', 'estado', 'cep', 'data_nascimento', 'contato_extra'];
      camposBody.forEach((campo) => {
        if (body.hasOwnProperty(campo)) {
          if (campo === 'cor_perfil') dados[campo] = body[campo] || '#ec5a1c';
          else if (campo === 'data_nascimento' || campo === 'contato_extra') dados[campo] = body[campo] || null;
          else dados[campo] = body[campo];
        }
      });
      if (fotoPerfilFile) dados.foto_perfil = `/images/perfil/${fotoPerfilFile.filename}`;
      if (fotoCapaFile) dados.foto_capa = `/images/capa/${fotoCapaFile.filename}`;

      if (Object.keys(dados).length === 0) {
        req.session.flash = { tipo: 'sucesso', mensagem: 'Nenhuma alteração enviada.' };
        return res.redirect('/perfil');
      }

      await Usuario.atualizarPerfil(id, dados);

      if (dados.nome !== undefined) req.session.usuario.nome = dados.nome;
      if (dados.cor_perfil !== undefined) req.session.usuario.cor_perfil = dados.cor_perfil;
      if (dados.foto_perfil !== undefined) req.session.usuario.foto_perfil = dados.foto_perfil;
      if (dados.foto_capa !== undefined) req.session.usuario.foto_capa = dados.foto_capa;

      req.session.flash = { tipo: 'sucesso', mensagem: 'Perfil atualizado com sucesso!' };
      const wantsJson = req.get('Accept') && req.get('Accept').includes('application/json');
      if (wantsJson) return res.json({ sucesso: true, mensagem: 'Perfil atualizado com sucesso!' });
      res.redirect('/perfil');
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao atualizar perfil', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar perfil.' };
      const wantsJson = req.get('Accept') && req.get('Accept').includes('application/json');
      if (wantsJson) return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar perfil.' });
      res.redirect('/perfil');
    }
  },

  async listarGaleria(req, res) {
    try {
      const uid = req.session.usuario.id;
      const linhas = await FotoPerfilPet.listarPorUsuario(uid);
      const porPet = {};
      linhas.forEach((f) => {
        if (!porPet[f.pet_id]) porPet[f.pet_id] = { pet_nome: f.pet_nome, pet_foto: f.pet_foto, fotos: [] };
        porPet[f.pet_id].fotos.push({ id: f.id, foto: f.foto });
      });
      res.json({ galeria: Object.entries(porPet).map(([pet_id, v]) => ({ pet_id: parseInt(pet_id, 10), pet_nome: v.pet_nome, pet_foto: v.pet_foto, fotos: v.fotos })) });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao listar galeria', erro);
      res.status(500).json({ galeria: [] });
    }
  },

  async adicionarFotoGaleria(req, res) {
    try {
      const uid = req.session.usuario.id;
      const pet_id = parseInt(req.body.pet_id, 10);
      if (!pet_id) return res.status(400).json({ sucesso: false, mensagem: 'Pet inválido.' });
      const pet = await Pet.buscarPorId(pet_id);
      if (!pet || pet.usuario_id !== uid) return res.status(403).json({ sucesso: false, mensagem: 'Pet não encontrado ou não é seu.' });
      const total = await FotoPerfilPet.contarPorPet(uid, pet_id);
      if (total >= FotoPerfilPet.MAX_FOTOS_POR_PET) return res.status(400).json({ sucesso: false, mensagem: `Máximo de ${FotoPerfilPet.MAX_FOTOS_POR_PET} fotos por pet.` });
      if (!req.file) return res.status(400).json({ sucesso: false, mensagem: 'Nenhuma imagem enviada.' });
      const foto = `/images/perfil-galeria/${req.file.filename}`;
      const registro = await FotoPerfilPet.criar(uid, pet_id, foto);
      res.json({ sucesso: true, id: registro.id, foto: registro.foto });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao adicionar foto galeria', erro);
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar.' });
    }
  },

  async removerFotoGaleria(req, res) {
    try {
      const uid = req.session.usuario.id;
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ sucesso: false });
      const registro = await FotoPerfilPet.deletar(id, uid);
      if (!registro) return res.status(404).json({ sucesso: false });
      const caminho = path.join(__dirname, '..', 'public', registro.foto);
      try { fs.unlinkSync(caminho); } catch (_) {}
      res.json({ sucesso: true });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao remover foto galeria', erro);
      res.status(500).json({ sucesso: false });
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
