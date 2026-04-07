const TagProductOrder = require('../models/TagProductOrder');
const TagOrderUnit = require('../models/TagOrderUnit');
const PlanDefinition = require('../models/PlanDefinition');
const Pet = require('../models/Pet');
const Usuario = require('../models/Usuario');
const tagCommerceService = require('../services/tagCommerceService');
const tagEntitlementService = require('../services/tagEntitlementService');
const logger = require('../utils/logger');
const { multerPublicUrl } = require('../middlewares/persistUploadMiddleware');
const { isSchemaMissingError } = require('../models/tagCommerceSchema');

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function redirecionarComFallbackSchema(req, res, redirectPath) {
  req.session.flash = {
    tipo: 'erro',
    mensagem: 'A área de pedidos TAG está em atualização no momento. Tente novamente em instantes.',
  };
  return res.redirect(redirectPath);
}

const tagCommerceController = {
  async mostrarLoja(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const planos = await tagCommerceService.carregarPlanos();
      const usuario = req.session?.usuario || null;
      const pets = usuario ? await Pet.buscarPorUsuario(usuario.id) : [];
      const estadoPlano = usuario ? await tagEntitlementService.obterEstadoPlano(usuario.id) : null;

      return res.render('tags/loja-tag', {
        titulo: 'Loja TAG AIRPET',
        planos,
        pets,
        estadoPlano,
      });
    } catch (err) {
      if (isSchemaMissingError(err)) {
        logger.warn('TagCommerceController', 'Schema TAG indisponível ao carregar loja');
        return res.status(503).render('partials/erro', {
          titulo: 'Em atualização',
          mensagem: 'A loja TAG está em atualização temporária. Tente novamente em instantes.',
          codigo: 503,
        });
      }
      logger.error('TagCommerceController', 'Erro ao carregar loja de tags', err);
      return res.status(500).render('partials/erro', {
        titulo: 'Erro',
        mensagem: 'Não foi possível carregar a loja de TAG agora.',
        codigo: 500,
      });
    }
  },

  async criarPedido(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const usuarioId = req.session.usuario.id;
      const petIds = toArray(req.body.pet_ids).map((v) => Number(v)).filter(Number.isFinite);
      const payload = {
        plan_slug: req.body.plan_slug,
        order_type: req.body.order_type,
        quantidade_tags: Number(req.body.quantidade_tags || 0),
        pet_ids: petIds,
        promo_code: req.body.promo_code,
      };

      const { pedido } = await tagCommerceService.criarPedido(usuarioId, payload);
      await tagCommerceService.aplicarIndicacao(req.body.referral_code, usuarioId, pedido.id);

      const usuario = await Usuario.buscarPorId(usuarioId);
      const checkout = await tagCommerceService.criarCheckout(usuario, pedido);

      if (checkout.checkout_url) {
        return res.redirect(checkout.checkout_url);
      }

      req.session.flash = {
        tipo: 'sucesso',
        mensagem: 'Pedido criado. Aguardando pagamento.',
      };
      return res.redirect(`/tags/pedidos/${pedido.id}`);
    } catch (err) {
      if (isSchemaMissingError(err)) {
        logger.warn('TagCommerceController', 'Schema TAG indisponível ao criar pedido');
        return redirecionarComFallbackSchema(req, res, '/tags/loja-tag');
      }
      logger.error('TagCommerceController', 'Erro ao criar pedido de tag', err);
      req.session.flash = { tipo: 'erro', mensagem: err.message || 'Não foi possível criar o pedido.' };
      return res.redirect('/tags/loja-tag');
    }
  },

  async listarPedidos(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const usuarioId = req.session.usuario.id;
      const pedidos = await TagProductOrder.listarPorUsuario(usuarioId);
      const estadoPlano = await tagEntitlementService.obterEstadoPlano(usuarioId);
      return res.render('tags/pedidos-lista', {
        titulo: 'Meus pedidos TAG',
        pedidos,
        estadoPlano,
      });
    } catch (err) {
      if (isSchemaMissingError(err)) {
        logger.warn('TagCommerceController', 'Schema TAG indisponível ao listar pedidos');
        return redirecionarComFallbackSchema(req, res, '/perfil');
      }
      logger.error('TagCommerceController', 'Erro ao listar pedidos TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar seus pedidos.' };
      return res.redirect('/perfil');
    }
  },

  async detalhePedido(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const usuarioId = req.session.usuario.id;
      const pedidoId = Number(req.params.id);
      const pedido = await TagProductOrder.buscarPorIdEUsuario(pedidoId, usuarioId);
      if (!pedido) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pedido não encontrado.' };
        return res.redirect('/tags/pedidos');
      }
      const unidades = await TagOrderUnit.listarPorPedido(pedido.id);
      const pets = await Pet.buscarPorUsuario(usuarioId);
      return res.render('tags/pedido-detalhe', {
        titulo: `Pedido #${pedido.id}`,
        pedido,
        unidades,
        pets,
      });
    } catch (err) {
      if (isSchemaMissingError(err)) {
        logger.warn('TagCommerceController', 'Schema TAG indisponível ao abrir detalhe de pedido');
        return redirecionarComFallbackSchema(req, res, '/tags/pedidos');
      }
      logger.error('TagCommerceController', 'Erro ao abrir detalhe pedido TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o pedido.' };
      return res.redirect('/tags/pedidos');
    }
  },

  async personalizarUnidade(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const usuarioId = req.session.usuario.id;
      const pedidoId = Number(req.params.id);
      const unitId = Number(req.params.unitId);
      const petId = Number(req.body.pet_id);
      const photoUrl = multerPublicUrl(req.file, 'tag-print');

      const pedido = await TagProductOrder.buscarPorIdEUsuario(pedidoId, usuarioId);
      if (!pedido) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pedido inválido.' };
        return res.redirect('/tags/pedidos');
      }

      if (Number.isFinite(petId)) {
        const changed = await TagOrderUnit.trocarPetComValidacao(pedidoId, unitId, usuarioId, petId);
        if (!changed) {
          req.session.flash = { tipo: 'erro', mensagem: 'Pet inválido para esta unidade.' };
          return res.redirect(`/tags/pedidos/${pedidoId}`);
        }
      }

      await TagOrderUnit.atualizarPersonalizacao(pedidoId, unitId, usuarioId, {
        print_photo_url: photoUrl || null,
        personalization_status: 'ok',
      });

      req.session.flash = { tipo: 'sucesso', mensagem: 'Personalização da tag salva com sucesso.' };
      return res.redirect(`/tags/pedidos/${pedidoId}`);
    } catch (err) {
      if (isSchemaMissingError(err)) {
        logger.warn('TagCommerceController', 'Schema TAG indisponível ao personalizar unidade');
        return redirecionarComFallbackSchema(req, res, '/tags/pedidos');
      }
      logger.error('TagCommerceController', 'Erro ao personalizar unidade TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar personalização da tag.' };
      return res.redirect(`/tags/pedidos/${req.params.id}`);
    }
  },

  async webhookInfinitePay(req, res) {
    try {
      const secret = process.env.INFINITEPAY_WEBHOOK_SECRET;
      if (secret && req.get('x-infinitepay-signature') !== secret) {
        return res.status(401).json({ ok: false, message: 'assinatura inválida' });
      }
      const out = await tagCommerceService.processarPagamentoWebhook(req.body || {});
      return res.json({ ok: true, pedido_id: out.pedido?.id, ja_processado: out.jaProcessado });
    } catch (err) {
      logger.error('TagCommerceController', 'Erro no webhook InfinitePay', err);
      return res.status(500).json({ ok: false, message: err.message || 'Erro no webhook.' });
    }
  },

  async retornoPagamento(req, res) {
    try {
      const pedidoId = Number(req.query.pedido_id);
      if (!Number.isFinite(pedidoId)) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pagamento retornou sem pedido válido.' };
        return res.redirect('/tags/pedidos');
      }
      req.session.flash = {
        tipo: 'sucesso',
        mensagem: 'Retorno do pagamento recebido. Confira o status atualizado do seu pedido.',
      };
      return res.redirect(`/tags/pedidos/${pedidoId}`);
    } catch (err) {
      logger.error('TagCommerceController', 'Erro no retorno de pagamento', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao confirmar retorno do pagamento.' };
      return res.redirect('/tags/pedidos');
    }
  },

  async mostrarPlanos(req, res) {
    const planos = await tagCommerceService.carregarPlanos();
    return res.render('tags/planos', { titulo: 'Planos TAG', planos });
  },
};

module.exports = tagCommerceController;
