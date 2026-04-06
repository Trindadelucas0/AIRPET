const Usuario = require('../models/Usuario');
const Pet = require('../models/Pet');
const FotoPerfilPet = require('../models/FotoPerfilPet');
const Raca = require('../models/Raca');
const logger = require('../utils/logger');
const { multerPublicUrl } = require('../middlewares/persistUploadMiddleware');
const storageService = require('../services/storageService');
const { profileVersionMs, stripUsuario } = require('../utils/syncContract');

const PERFIS_RETURN_ALLOWED = new Set([
  '/perfil',
  '/perfil/conta',
  '/perfil/aparencia',
  '/perfil/localizacao',
  '/perfil/seguranca',
  '/perfil/galeria',
]);

function sanitizeReturnTo(raw) {
  if (!raw || typeof raw !== 'string') return '/perfil';
  const t = raw.trim();
  return PERFIS_RETURN_ALLOWED.has(t) ? t : '/perfil';
}

function montarGaleriaPorPet(linhas) {
  const porPet = {};
  linhas.forEach((f) => {
    if (!porPet[f.pet_id]) {
      porPet[f.pet_id] = { pet_nome: f.pet_nome, pet_foto: f.pet_foto, fotos: [] };
    }
    porPet[f.pet_id].fotos.push({ id: f.id, foto: f.foto });
  });
  return Object.entries(porPet).map(([pet_id, v]) => ({
    pet_id: parseInt(pet_id, 10),
    pet_nome: v.pet_nome,
    pet_foto: v.pet_foto,
    fotos: v.fotos,
  }));
}

function renderErroPerfil(res, mensagem) {
  return res.status(500).render('perfil/erro', {
    titulo: 'Algo deu errado',
    mensagem: mensagem || 'Não foi possível carregar esta seção.',
    voltar: '/perfil',
    extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
  });
}

const perfilController = {
  async mostrarPerfilHub(req, res) {
    try {
      const usuario = await Usuario.buscarPorId(req.session.usuario.id);
      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/');
      }
      return res.render('perfil/hub', {
        titulo: 'Configurações',
        perfil: usuario,
        extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
      });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao carregar hub de perfil', erro);
      return renderErroPerfil(res, 'Não foi possível carregar as configurações.');
    }
  },

  async mostrarConta(req, res) {
    try {
      const usuario = await Usuario.buscarPorId(req.session.usuario.id);
      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/');
      }
      return res.render('perfil/conta', {
        titulo: 'Dados e bio',
        perfil: usuario,
        settingsSectionTitle: 'Dados pessoais',
        extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
      });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao carregar conta', erro);
      return renderErroPerfil(res);
    }
  },

  async mostrarAparencia(req, res) {
    try {
      const usuario = await Usuario.buscarPorId(req.session.usuario.id);
      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/');
      }
      return res.render('perfil/aparencia', {
        titulo: 'Cor de destaque',
        perfil: usuario,
        settingsSectionTitle: 'Aparência',
        extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
      });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao carregar aparência', erro);
      return renderErroPerfil(res);
    }
  },

  async mostrarLocalizacao(req, res) {
    try {
      const usuario = await Usuario.buscarPorId(req.session.usuario.id);
      if (!usuario) {
        req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
        return res.redirect('/');
      }
      return res.render('perfil/localizacao', {
        titulo: 'Endereço e região',
        perfil: usuario,
        settingsSectionTitle: 'Localização',
        extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
      });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao carregar localização', erro);
      return renderErroPerfil(res);
    }
  },

  async mostrarSeguranca(req, res) {
    try {
      return res.render('perfil/seguranca', {
        titulo: 'Segurança',
        perfil: req.session.usuario,
        settingsSectionTitle: 'Segurança',
        extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
      });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao carregar segurança', erro);
      return renderErroPerfil(res);
    }
  },

  async mostrarGaleriaPagina(req, res) {
    try {
      const uid = req.session.usuario.id;
      const [meusPets, linhas] = await Promise.all([
        Pet.buscarPorUsuario(uid),
        FotoPerfilPet.listarPorUsuario(uid),
      ]);
      const galeria = montarGaleriaPorPet(linhas);
      return res.render('perfil/galeria', {
        titulo: 'Galeria dos pets',
        perfil: req.session.usuario,
        meusPets,
        galeria,
        settingsSectionTitle: 'Galeria dos pets',
        extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
      });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao carregar galeria', erro);
      return renderErroPerfil(res);
    }
  },

  async atualizar(req, res) {
    try {
      const id = req.session.usuario.id;
      const body = req.body || {};
      const files = req.files || {};
      const fotoPerfilFile = files.foto_perfil && files.foto_perfil[0];
      const fotoCapaFile = files.foto_capa && files.foto_capa[0];
      const returnTo = sanitizeReturnTo(body.return_to);

      const dados = {};
      const camposBody = [
        'nome', 'telefone', 'cor_perfil', 'bio', 'apelido', 'endereco', 'bairro', 'cidade', 'estado', 'cep',
        'data_nascimento', 'contato_extra', 'receber_alertas_pet_perdido',
      ];
      camposBody.forEach((campo) => {
        if (Object.prototype.hasOwnProperty.call(body, campo)) {
          if (campo === 'cor_perfil') dados[campo] = body[campo] || '#ec5a1c';
          else if (campo === 'receber_alertas_pet_perdido') {
            dados[campo] = body[campo] === true || body[campo] === 'true' || body[campo] === '1';
          } else if (campo === 'data_nascimento' || campo === 'contato_extra') dados[campo] = body[campo] || null;
          else dados[campo] = body[campo];
        }
      });
      const urlPerfil = fotoPerfilFile ? multerPublicUrl(fotoPerfilFile, 'perfil') : null;
      const urlCapa = fotoCapaFile ? multerPublicUrl(fotoCapaFile, 'capa') : null;
      if (urlPerfil) dados.foto_perfil = urlPerfil;
      if (urlCapa) dados.foto_capa = urlCapa;

      if (Object.keys(dados).length === 0) {
        req.session.flash = { tipo: 'sucesso', mensagem: 'Nenhuma alteração enviada.' };
        const wantsJson = req.get('Accept') && req.get('Accept').includes('application/json');
        if (wantsJson) {
          const u = await Usuario.buscarPorId(id);
          return res.json({
            sucesso: true,
            mensagem: 'Nenhuma alteração enviada.',
            profileVersion: profileVersionMs(u),
            user: stripUsuario(u),
          });
        }
        return res.redirect(returnTo);
      }

      await Usuario.atualizarPerfil(id, dados);

      if (dados.nome !== undefined) req.session.usuario.nome = dados.nome;
      if (dados.cor_perfil !== undefined) req.session.usuario.cor_perfil = dados.cor_perfil;
      if (dados.foto_perfil !== undefined) req.session.usuario.foto_perfil = dados.foto_perfil;
      if (dados.foto_capa !== undefined) req.session.usuario.foto_capa = dados.foto_capa;
      if (dados.apelido !== undefined) req.session.usuario.apelido = dados.apelido;

      req.session.flash = { tipo: 'sucesso', mensagem: 'Perfil atualizado com sucesso!' };
      const wantsJson = req.get('Accept') && req.get('Accept').includes('application/json');
      if (wantsJson) {
        const usuarioAtual = await Usuario.buscarPorId(id);
        return res.json({
          sucesso: true,
          mensagem: 'Perfil atualizado com sucesso!',
          profileVersion: profileVersionMs(usuarioAtual),
          user: stripUsuario(usuarioAtual),
        });
      }
      return res.redirect(returnTo);
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao atualizar perfil', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar perfil.' };
      const wantsJson = req.get('Accept') && req.get('Accept').includes('application/json');
      if (wantsJson) return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar perfil.' });
      return res.redirect(sanitizeReturnTo((req.body || {}).return_to));
    }
  },

  async listarGaleria(req, res) {
    try {
      const uid = req.session.usuario.id;
      const linhas = await FotoPerfilPet.listarPorUsuario(uid);
      const galeria = montarGaleriaPorPet(linhas);
      res.json({ galeria });
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
      if (total >= FotoPerfilPet.MAX_FOTOS_POR_PET) {
        return res.status(400).json({ sucesso: false, mensagem: `Máximo de ${FotoPerfilPet.MAX_FOTOS_POR_PET} fotos por pet.` });
      }
      if (!req.file) return res.status(400).json({ sucesso: false, mensagem: 'Nenhuma imagem enviada.' });
      const foto = multerPublicUrl(req.file, 'perfil-galeria');
      if (!foto) return res.status(400).json({ sucesso: false, mensagem: 'Não foi possível salvar a imagem.' });
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
      await storageService.removeByPublicUrl(registro.foto);
      res.json({ sucesso: true });
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao remover foto galeria', erro);
      res.status(500).json({ sucesso: false });
    }
  },

  async buscarRacas(req, res) {
    try {
      const { tipo, q } = req.query;
      const rows = await Raca.buscar({ tipo, q, limite: 50 });
      res.json(rows);
    } catch (erro) {
      logger.error('PERFIL_CTRL', 'Erro ao buscar raças', erro);
      res.status(500).json([]);
    }
  },
};

module.exports = perfilController;
