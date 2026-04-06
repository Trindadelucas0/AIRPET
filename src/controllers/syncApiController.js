/**
 * GET/PATCH /api/v1/me, following, preferences — ETag, profileVersion, contrato para cache local (SWR).
 */

const Usuario = require('../models/Usuario');
const Seguidor = require('../models/Seguidor');
const ApiIdempotencyResponse = require('../models/ApiIdempotencyResponse');
const logger = require('../utils/logger');
const {
  profileVersionMs,
  stripUsuario,
  etagMe,
  etagFollowing,
  etagPreferences,
} = require('../utils/syncContract');

const IDEMP_SCOPE_PATCH_ME = 'patch_me_v1';

function usuarioSinc(req) {
  return req.airpetApiUser || (req.session && req.session.usuario) || null;
}

const CAMPOS_PATCH_ME = [
  'nome',
  'telefone',
  'cor_perfil',
  'bio',
  'apelido',
  'endereco',
  'bairro',
  'cidade',
  'estado',
  'cep',
  'data_nascimento',
  'contato_extra',
  'receber_alertas_pet_perdido',
];

const syncApiController = {
  async getMe(req, res) {
    try {
      const su = usuarioSinc(req);
      if (!su) return res.status(401).json({ sucesso: false, mensagem: 'Autenticação necessária.' });
      const usuario = await Usuario.buscarPorId(su.id);
      if (!usuario) {
        return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
      }
      const tag = etagMe(usuario);
      if (req.get('If-None-Match') === tag) {
        return res.status(304).end();
      }
      res.set('ETag', tag);
      res.set('Cache-Control', 'private, no-store');
      return res.json({
        schemaVersion: 1,
        sucesso: true,
        profileVersion: profileVersionMs(usuario),
        updatedAt: usuario.data_atualizacao,
        user: stripUsuario(usuario),
      });
    } catch (erro) {
      logger.error('SYNC_API', 'Erro em getMe', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar o perfil.' });
    }
  },

  async getPreferences(req, res) {
    try {
      const su = usuarioSinc(req);
      if (!su) return res.status(401).json({ sucesso: false, mensagem: 'Autenticação necessária.' });
      const usuario = await Usuario.buscarPorId(su.id);
      if (!usuario) {
        return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
      }
      const tag = etagPreferences(usuario);
      if (req.get('If-None-Match') === tag) {
        return res.status(304).end();
      }
      res.set('ETag', tag);
      res.set('Cache-Control', 'private, no-store');
      return res.json({
        schemaVersion: 1,
        sucesso: true,
        profileVersion: profileVersionMs(usuario),
        preferences: {
          cor_perfil: usuario.cor_perfil || '#ec5a1c',
          receber_alertas_pet_perdido: usuario.receber_alertas_pet_perdido !== false,
        },
      });
    } catch (erro) {
      logger.error('SYNC_API', 'Erro em getPreferences', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar preferências.' });
    }
  },

  async getFollowing(req, res) {
    try {
      const su = usuarioSinc(req);
      if (!su) return res.status(401).json({ sucesso: false, mensagem: 'Autenticação necessária.' });
      const uid = su.id;
      const limite = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const resumo = await Seguidor.resumoSeguindo(uid);
      const tag = etagFollowing(uid, resumo);
      if (req.get('If-None-Match') === tag) {
        return res.status(304).end();
      }
      const lista = await Seguidor.listarSeguindo(uid, limite);
      res.set('ETag', tag);
      res.set('Cache-Control', 'private, no-store');
      return res.json({
        schemaVersion: 1,
        sucesso: true,
        listVersion: `${resumo.total}-${resumo.ultima_mudanca ? new Date(resumo.ultima_mudanca).getTime() : 0}`,
        total: resumo.total,
        ultimaMudanca: resumo.ultima_mudanca,
        following: lista.map((r) => ({
          id: r.id,
          nome: r.nome,
          cor_perfil: r.cor_perfil,
          foto_perfil: r.foto_perfil,
          seguindo_desde: r.criado_em,
        })),
      });
    } catch (erro) {
      logger.error('SYNC_API', 'Erro em getFollowing', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar seguindo.' });
    }
  },

  async patchMe(req, res) {
    try {
      const su = usuarioSinc(req);
      if (!su) return res.status(401).json({ sucesso: false, mensagem: 'Autenticação necessária.' });
      const id = su.id;
      const idem = (req.get('Idempotency-Key') || '').trim();
      if (idem && idem.length <= 128) {
        const hit = await ApiIdempotencyResponse.buscarRecente(id, IDEMP_SCOPE_PATCH_ME, idem);
        if (hit) return res.status(hit.status_code).json(hit.body_json);
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const dados = {};
      CAMPOS_PATCH_ME.forEach((campo) => {
        if (!Object.prototype.hasOwnProperty.call(body, campo)) return;
        if (campo === 'cor_perfil') dados[campo] = body[campo] || '#ec5a1c';
        else if (campo === 'receber_alertas_pet_perdido') {
          dados[campo] = body[campo] === true || body[campo] === 'true' || body[campo] === '1' || body[campo] === 1;
        } else if (campo === 'data_nascimento' || campo === 'contato_extra' || campo === 'bio' || campo === 'apelido') {
          dados[campo] = body[campo] == null || body[campo] === '' ? null : body[campo];
        } else dados[campo] = body[campo];
      });

      if (Object.keys(dados).length === 0) {
        const usuario = await Usuario.buscarPorId(id);
        const payload = {
          schemaVersion: 1,
          sucesso: true,
          mensagem: 'Nenhuma alteração.',
          profileVersion: profileVersionMs(usuario),
          user: stripUsuario(usuario),
        };
        return res.json(payload);
      }

      const atualizado = await Usuario.atualizarPerfil(id, dados);

      if (req.session && req.session.usuario) {
        if (dados.nome !== undefined) req.session.usuario.nome = dados.nome;
        if (dados.cor_perfil !== undefined) req.session.usuario.cor_perfil = dados.cor_perfil;
        if (dados.apelido !== undefined) req.session.usuario.apelido = dados.apelido;
      }
      if (req.airpetAuthUser) {
        if (dados.nome !== undefined) req.airpetAuthUser.nome = dados.nome;
        if (dados.cor_perfil !== undefined) req.airpetAuthUser.cor_perfil = dados.cor_perfil;
        if (dados.apelido !== undefined) req.airpetAuthUser.apelido = dados.apelido;
      }

      const payload = {
        schemaVersion: 1,
        sucesso: true,
        mensagem: 'Perfil atualizado.',
        profileVersion: profileVersionMs(atualizado),
        updatedAt: atualizado.data_atualizacao,
        user: stripUsuario(atualizado),
      };

      if (idem && idem.length <= 128) {
        await ApiIdempotencyResponse.salvar(id, IDEMP_SCOPE_PATCH_ME, idem, 200, payload);
      }

      return res.json(payload);
    } catch (erro) {
      logger.error('SYNC_API', 'Erro em patchMe', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar perfil.' });
    }
  },
};

module.exports = syncApiController;
