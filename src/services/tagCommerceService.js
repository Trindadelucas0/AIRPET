const { withTransaction } = require('../config/database');
const { PLANOS_PADRAO, precoHardwarePorQuantidade } = require('../config/planos');
const TagProductOrder = require('../models/TagProductOrder');
const TagOrderUnit = require('../models/TagOrderUnit');
const PromoCode = require('../models/PromoCode');
const Referral = require('../models/Referral');
const PaymentEvent = require('../models/PaymentEvent');
const NfcTag = require('../models/NfcTag');
const TagSubscription = require('../models/TagSubscription');
const PlanDefinition = require('../models/PlanDefinition');
const Pet = require('../models/Pet');
const infinitePayService = require('./infinitePayService');
const tagEntitlementService = require('./tagEntitlementService');
const logger = require('../utils/logger');
const { ensureTagCommerceSchema } = require('../models/tagCommerceSchema');

function normalizarPlano(slug) {
  const valor = String(slug || 'basico').toLowerCase();
  return PLANOS_PADRAO.find((p) => p.slug === valor)?.slug || 'basico';
}

function calcularDescontoPromo(promo, subtotal) {
  if (!promo) return 0;
  if (promo.tipo === 'fixo') return Math.min(subtotal, Number(promo.valor || 0));
  const percentual = Number(promo.valor || 0);
  return Math.max(0, Math.floor((subtotal * percentual) / 100));
}

const tagCommerceService = {
  async ensurePedidosSchema() {
    await ensureTagCommerceSchema();
  },

  async carregarPlanos() {
    await ensureTagCommerceSchema();
    const dbPlans = await PlanDefinition.listarAtivos();
    if (dbPlans && dbPlans.length > 0) return dbPlans;
    return PLANOS_PADRAO.map((p) => ({
      slug: p.slug,
      nome_exibicao: p.nome,
      mensalidade_centavos: p.mensalidade_centavos,
      ordem: p.ordem,
      ativo: true,
      features_json: p.features,
    }));
  },

  async validarCarrinho(usuarioId, payload) {
    await ensureTagCommerceSchema();
    const plano = normalizarPlano(payload.plan_slug);
    const orderType = payload.order_type === 'assinatura_recorrente' ? 'assinatura_recorrente' : 'compra_tag';
    const quantidadeTagsBase = Math.max(0, Number(payload.quantidade_tags || 0));
    const quantidadeTags = orderType === 'compra_tag' ? quantidadeTagsBase : 0;
    const petIds = Array.isArray(payload.pet_ids) ? payload.pet_ids.map((p) => Number(p)).filter(Number.isFinite) : [];

    if (orderType === 'compra_tag') {
      if (quantidadeTags < 1) throw new Error('Quantidade de tags inválida.');
      if (petIds.length !== quantidadeTags) throw new Error('Cada tag precisa estar vinculada a um pet já cadastrado.');
    }

    const petsUsuario = await Pet.buscarPorUsuario(usuarioId);
    if (petsUsuario.length > 10) throw new Error('Limite máximo de 10 pets por usuário excedido.');

    const petSet = new Set(petsUsuario.map((p) => Number(p.id)));
    for (const petId of petIds) {
      if (!petSet.has(petId)) throw new Error('Pet selecionado não pertence ao usuário.');
    }

    const planoDef = (await this.carregarPlanos()).find((p) => p.slug === plano) || PLANOS_PADRAO[0];
    const mensalidade = Number(planoDef.mensalidade_centavos || 0);
    const precoTags = orderType === 'compra_tag' ? precoHardwarePorQuantidade(quantidadeTags) : 0;
    const subtotal = precoTags + mensalidade;

    let promo = null;
    let desconto = 0;
    const promoCode = payload.promo_code ? String(payload.promo_code).trim().toUpperCase() : null;
    if (promoCode) {
      promo = await PromoCode.buscarPorCodigo(promoCode);
      if (!promo || !promo.ativo) {
        throw new Error('Cupom inválido ou inativo.');
      }
      const agora = new Date();
      if (promo.valid_from && new Date(promo.valid_from) > agora) throw new Error('Cupom ainda não disponível.');
      if (promo.valid_until && new Date(promo.valid_until) < agora) throw new Error('Cupom expirado.');
      const usos = await PromoCode.contarUsos(promo.id, usuarioId);
      if (promo.max_usos_global && usos.usos_total >= promo.max_usos_global) throw new Error('Cupom sem saldo de uso.');
      if (promo.max_usos_por_usuario && usos.usos_usuario >= promo.max_usos_por_usuario) throw new Error('Você já atingiu o limite deste cupom.');
      desconto = calcularDescontoPromo(promo, subtotal);
    }

    return {
      plano,
      order_type: orderType,
      quantidade_tags: quantidadeTags,
      pet_ids: petIds,
      mensalidade_centavos: mensalidade,
      preco_tags_centavos: precoTags,
      subtotal_centavos: subtotal,
      desconto_centavos: desconto,
      total_centavos: Math.max(0, subtotal - desconto),
      promo_code: promoCode,
      promo,
    };
  },

  async criarPedido(usuarioId, payload) {
    await ensureTagCommerceSchema();
    const carrinho = await this.validarCarrinho(usuarioId, payload);
    const snapshot = {
      carrinho,
      regra_renovacao: 'valid_until_novo = max(valid_until_atual, pago_em) + 30 dias',
      grace_hours: tagEntitlementService.graceHours(),
      created_at: new Date().toISOString(),
    };

    const unidades = carrinho.order_type === 'compra_tag'
      ? carrinho.pet_ids.map((petId, idx) => ({ sequencia: idx + 1, pet_id: petId, personalization_status: 'pendente' }))
      : [];

    const pedido = await TagProductOrder.criarComUnidades(
      {
        usuario_id: usuarioId,
        plan_slug: carrinho.plano,
        order_type: carrinho.order_type,
        status: 'aguardando_pagamento',
        quantidade_tags: carrinho.quantidade_tags,
        subtotal_centavos: carrinho.subtotal_centavos,
        desconto_centavos: carrinho.desconto_centavos,
        total_centavos: carrinho.total_centavos,
        promo_code: carrinho.promo_code,
        snapshot_json: snapshot,
      },
      unidades
    );

    if (carrinho.promo) {
      await PromoCode.registrarUso(carrinho.promo.id, usuarioId, pedido.id, carrinho.desconto_centavos);
    }

    return { pedido, carrinho };
  },

  async criarCheckout(usuario, pedido) {
    const orderNsu = infinitePayService.gerarOrderNsu('tag');
    const retornoUrl = `${process.env.BASE_URL || ''}/tags/pagamentos/retorno?pedido_id=${pedido.id}`;
    const webhookUrl = `${process.env.BASE_URL || ''}/tags/pagamentos/webhook/infinitepay`;
    const descricao = pedido.order_type === 'assinatura_recorrente'
      ? `Assinatura TAG ${pedido.plan_slug}`
      : `TAG NFC (${pedido.quantidade_tags} unidade(s)) + assinatura ${pedido.plan_slug}`;

    const checkout = await infinitePayService.criarCheckoutLink({
      orderNsu,
      itens: [{ description: descricao, quantity: 1, price: pedido.total_centavos }],
      customer: { name: usuario.nome, email: usuario.email },
      redirectUrl: retornoUrl,
      webhookUrl,
    });

    return TagProductOrder.atualizarCheckout(
      pedido.id,
      checkout.order_nsu,
      checkout.checkout_url,
      checkout.invoice_slug
    );
  },

  async processarPagamentoWebhook(payload) {
    await ensureTagCommerceSchema();
    const orderNsu = payload?.order_nsu || payload?.orderNsu;
    const transactionNsu = payload?.transaction_nsu || payload?.transactionNsu || null;
    if (!orderNsu) throw new Error('Webhook sem order_nsu.');

    const pedido = await TagProductOrder.buscarPorOrderNsu(orderNsu);
    if (!pedido) throw new Error('Pedido não encontrado para order_nsu informado.');

    await PaymentEvent.registrar({
      order_id: pedido.id,
      usuario_id: pedido.usuario_id,
      provider: 'infinitepay',
      event_type: 'payment_completed',
      order_nsu: orderNsu,
      transaction_nsu: transactionNsu,
      status: 'received',
      payload_json: payload,
    });

    if (pedido.status === 'pago') {
      return { pedido, jaProcessado: true };
    }

    const atualizado = await TagProductOrder.marcarPago(pedido.id, transactionNsu);
    await tagEntitlementService.renovarPorPagamento(pedido.usuario_id, pedido.plan_slug, transactionNsu);

    if (atualizado.order_type === 'compra_tag' && Number(atualizado.quantidade_tags || 0) > 0) {
      await withTransaction(async (client) => {
        const unidades = await client.query(
          `SELECT * FROM tag_order_units WHERE order_id = $1 ORDER BY sequencia ASC`,
          [atualizado.id]
        );

        const estoque = await NfcTag.listarDisponiveisEstoque(unidades.rows.length, client);
        if (estoque.length < unidades.rows.length) {
          throw new Error('Estoque de tags insuficiente para alocação automática.');
        }

        for (let i = 0; i < unidades.rows.length; i += 1) {
          const unidade = unidades.rows[i];
          const tagFisica = estoque[i];
          const reservada = await NfcTag.reservar(tagFisica.id, atualizado.usuario_id, client);
          if (!reservada) throw new Error('Falha ao reservar tag no estoque para o pedido.');
          await client.query(
            `UPDATE nfc_tags SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [tagFisica.id]
          );
          await client.query(
            `UPDATE tag_order_units
             SET nfc_tag_id = $2, data_atualizacao = NOW()
             WHERE id = $1`,
            [unidade.id, tagFisica.id]
          );
        }
      });
    }

    return { pedido: atualizado, jaProcessado: false };
  },

  async aplicarIndicacao(referralCode, usuarioId, orderId) {
    await ensureTagCommerceSchema();
    if (!referralCode) return null;
    const ref = await Referral.buscarPorCodigo(referralCode);
    if (!ref || Number(ref.usuario_id) === Number(usuarioId)) return null;
    return Referral.registrarCredito(ref.usuario_id, usuarioId, orderId, 'valor', 500, 0);
  },
};

module.exports = tagCommerceService;
