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
const UPGRADE_DISCOUNT_CENTS = Number(process.env.TAG_UPGRADE_DISCOUNT_CENTS || 1000);

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

function somenteDigitos(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizarTexto(value, maxLen = 255) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.slice(0, maxLen);
}

function validarCpf(cpfRaw) {
  const cpf = somenteDigitos(cpfRaw);
  if (!cpf || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += Number(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(cpf[10]);
}

function validarCnpj(cnpjRaw) {
  const cnpj = somenteDigitos(cnpjRaw);
  if (!cnpj || cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, ...pesos1];
  let soma = 0;
  for (let i = 0; i < 12; i += 1) soma += Number(cnpj[i]) * pesos1[i];
  let resto = soma % 11;
  const dig1 = resto < 2 ? 0 : 11 - resto;
  if (dig1 !== Number(cnpj[12])) return false;
  soma = 0;
  for (let i = 0; i < 13; i += 1) soma += Number(cnpj[i]) * pesos2[i];
  resto = soma % 11;
  const dig2 = resto < 2 ? 0 : 11 - resto;
  return dig2 === Number(cnpj[13]);
}

function validarCpfOuCnpj(documento) {
  const digits = somenteDigitos(documento);
  if (digits.length === 11) return validarCpf(digits);
  if (digits.length === 14) return validarCnpj(digits);
  return false;
}

function normalizarBilling(payload = {}) {
  const billing = {
    billing_name: normalizarTexto(payload.billing_name, 150),
    billing_cpf_cnpj: somenteDigitos(payload.billing_cpf_cnpj).slice(0, 14),
    billing_phone: normalizarTexto(payload.billing_phone, 30),
    billing_cep: somenteDigitos(payload.billing_cep).slice(0, 8),
    billing_logradouro: normalizarTexto(payload.billing_logradouro, 160),
    billing_numero: normalizarTexto(payload.billing_numero, 20),
    billing_complemento: normalizarTexto(payload.billing_complemento, 100),
    billing_bairro: normalizarTexto(payload.billing_bairro, 100),
    billing_cidade: normalizarTexto(payload.billing_cidade, 100),
    billing_uf: normalizarTexto(payload.billing_uf, 2).toUpperCase(),
  };

  if (!billing.billing_name) throw new Error('Informe o nome completo para nota fiscal.');
  if (!validarCpfOuCnpj(billing.billing_cpf_cnpj)) throw new Error('CPF/CNPJ inválido para nota fiscal.');
  if (billing.billing_cep.length !== 8) throw new Error('CEP inválido para nota fiscal.');
  if (!billing.billing_logradouro || !billing.billing_numero || !billing.billing_bairro || !billing.billing_cidade || billing.billing_uf.length !== 2) {
    throw new Error('Preencha o endereço completo para emissão da nota fiscal.');
  }

  return billing;
}

function normalizarPhoneNumber(rawPhone) {
  const digits = somenteDigitos(rawPhone);
  if (!digits) return undefined;
  if (digits.length === 13 && digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function parseValorCentavos(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n < 1000 && Number.isInteger(n) === false) {
    return Math.round(n * 100);
  }
  return Math.round(n);
}

function extrairValoresWebhook(payload) {
  const amount = parseValorCentavos(payload?.amount ?? payload?.payment?.amount ?? payload?.data?.amount);
  const paidAmount = parseValorCentavos(payload?.paid_amount ?? payload?.payment?.paid_amount ?? payload?.data?.paid_amount);

  const candidatos = [
    amount,
    parseValorCentavos(payload?.total),
    parseValorCentavos(payload?.total_amount),
    parseValorCentavos(payload?.amount_cents),
    parseValorCentavos(payload?.payment?.total),
    parseValorCentavos(payload?.payment?.amount_cents),
    parseValorCentavos(payload?.data?.total),
    parseValorCentavos(payload?.data?.amount_cents),
    paidAmount,
  ];

  let valorPedido = null;
  for (const valor of candidatos) {
    if (Number.isFinite(valor)) {
      valorPedido = Number(valor);
      break;
    }
  }

  return {
    valorPedidoCentavos: valorPedido,
    paidAmountCentavos: Number.isFinite(paidAmount) ? Number(paidAmount) : null,
  };
}

function extrairValorCentavosComFallback(payload) {
  const candidatos = [
    payload?.amount,
    payload?.total,
    payload?.total_amount,
    payload?.amount_cents,
    payload?.paid_amount,
    payload?.payment?.amount,
    payload?.payment?.total,
    payload?.payment?.amount_cents,
    payload?.data?.amount,
    payload?.data?.total,
    payload?.data?.amount_cents,
  ];

  for (const valor of candidatos) {
    if (valor === undefined || valor === null || valor === '') continue;
    const n = Number(valor);
    if (!Number.isFinite(n)) continue;
    if (n > 0 && n < 1000 && Number.isInteger(n) === false) {
      return Math.round(n * 100);
    }
    return Math.round(n);
  }
  return null;
}

function toPlanOrderMap(planos = []) {
  const map = new Map();
  (planos || []).forEach((plano, idx) => {
    const slug = String(plano.slug || '').trim().toLowerCase();
    if (!slug) return;
    const ordemNum = Number(plano.ordem);
    map.set(slug, Number.isFinite(ordemNum) ? ordemNum : (idx + 1));
  });
  PLANOS_PADRAO.forEach((plano, idx) => {
    const slug = String(plano.slug || '').trim().toLowerCase();
    if (!slug || map.has(slug)) return;
    const ordemNum = Number(plano.ordem);
    map.set(slug, Number.isFinite(ordemNum) ? ordemNum : (idx + 1));
  });
  return map;
}

function highestPlanSlug(slugs = [], orderMap = new Map()) {
  let best = null;
  let bestOrder = -Infinity;
  (slugs || []).forEach((slugRaw) => {
    const slug = String(slugRaw || '').trim().toLowerCase();
    if (!slug) return;
    const ordem = Number(orderMap.get(slug));
    if (Number.isFinite(ordem) && ordem > bestOrder) {
      bestOrder = ordem;
      best = slug;
    }
  });
  return best;
}

function normalizarBaseUrlPublica() {
  const raw = String(process.env.BASE_URL || '').trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BASE_URL não configurada. Defina uma URL pública HTTPS para checkout/webhook.');
    }
    return 'http://localhost:3000';
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('BASE_URL inválida. Use uma URL absoluta, ex.: https://airpet.seuregistroonline.com.br');
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error('BASE_URL inválida. O protocolo deve ser http:// ou https://.');
  }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('BASE_URL em produção precisa usar HTTPS.');
  }
  const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname || ''}`.replace(/\/+$/, '');
  return normalized || `${parsed.protocol}//${parsed.host}`;
}

function resolveCheckoutUrls(pedidoId) {
  const base = normalizarBaseUrlPublica();
  const webhookOverride = String(process.env.INFINITEPAY_WEBHOOK_URL || '').trim();
  const redirectOverride = String(process.env.INFINITEPAY_REDIRECT_URL || '').trim();

  const webhookBase = webhookOverride || `${base}/tags/pagamentos/webhook/infinitepay`;
  const redirectBase = redirectOverride || `${base}/tags/pagamentos/retorno`;

  let webhookUrl;
  let redirectUrl;
  try {
    webhookUrl = new URL(webhookBase).toString();
    const redirectParsed = new URL(redirectBase);
    redirectParsed.searchParams.set('pedido_id', String(pedidoId));
    redirectUrl = redirectParsed.toString();
  } catch {
    throw new Error('URL de checkout inválida. Verifique BASE_URL/INFINITEPAY_WEBHOOK_URL/INFINITEPAY_REDIRECT_URL.');
  }
  return { webhookUrl, redirectUrl };
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
    const billing = normalizarBilling(payload.billing || {});
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

    const planosDisponiveis = await this.carregarPlanos();
    const planoDef = planosDisponiveis.find((p) => p.slug === plano) || PLANOS_PADRAO[0];
    const mensalidade = Number(planoDef.mensalidade_centavos || 0);
    const precoTags = orderType === 'compra_tag' ? precoHardwarePorQuantidade(quantidadeTags) : 0;
    const subtotal = precoTags + mensalidade;

    const contextoUpgrade = await this.obterContextoUpgrade(usuarioId, planosDisponiveis);
    const ordemDestino = Number(contextoUpgrade.orderMap.get(plano));
    const ordemReferencia = Number(contextoUpgrade.orderMap.get(contextoUpgrade.referencePlanSlug || ''));
    const isUpgrade = Boolean(
      contextoUpgrade.hasPaidOrder
      && contextoUpgrade.referencePlanSlug
      && Number.isFinite(ordemDestino)
      && Number.isFinite(ordemReferencia)
      && ordemDestino > ordemReferencia
    );
    const descontoUpgrade = isUpgrade ? Math.min(UPGRADE_DISCOUNT_CENTS, Math.max(0, mensalidade)) : 0;

    let promo = null;
    let descontoPromo = 0;
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
      descontoPromo = calcularDescontoPromo(promo, subtotal);
    }
    const descontoTotal = Math.min(subtotal, descontoUpgrade + descontoPromo);

    return {
      plano,
      order_type: orderType,
      quantidade_tags: quantidadeTags,
      pet_ids: petIds,
      mensalidade_centavos: mensalidade,
      preco_tags_centavos: precoTags,
      subtotal_centavos: subtotal,
      desconto_centavos: descontoTotal,
      desconto_upgrade_centavos: descontoUpgrade,
      desconto_promo_centavos: descontoPromo,
      auto_discount_centavos: descontoUpgrade,
      auto_discount_reason: isUpgrade ? 'upgrade_cliente_pago' : null,
      upgrade_detectado: isUpgrade,
      plano_referencia_upgrade: contextoUpgrade.referencePlanSlug || null,
      total_centavos: Math.max(0, subtotal - descontoTotal),
      promo_code: promoCode,
      promo,
      billing,
    };
  },

  async obterContextoUpgrade(usuarioId, planosDisponiveis = null) {
    await ensureTagCommerceSchema();
    const planos = Array.isArray(planosDisponiveis) && planosDisponiveis.length
      ? planosDisponiveis
      : await this.carregarPlanos();
    const orderMap = toPlanOrderMap(planos);
    const paidPlanSlugs = await TagProductOrder.listarSlugsPagosPorUsuario(usuarioId);
    const hasPaidOrder = paidPlanSlugs.length > 0;
    const estadoPlano = await tagEntitlementService.obterEstadoPlano(usuarioId).catch(() => null);

    let referencePlanSlug = null;
    if (estadoPlano && estadoPlano.planoAtivo && estadoPlano.planSlug) {
      referencePlanSlug = String(estadoPlano.planSlug).trim().toLowerCase();
    }
    if (!referencePlanSlug && hasPaidOrder) {
      referencePlanSlug = highestPlanSlug(paidPlanSlugs, orderMap);
    }

    return {
      hasPaidOrder,
      paidPlanSlugs,
      referencePlanSlug: referencePlanSlug || null,
      orderMap,
    };
  },

  async criarPedido(usuarioId, payload) {
    await ensureTagCommerceSchema();
    const carrinho = await this.validarCarrinho(usuarioId, payload);
    const snapshot = {
      carrinho,
      billing: carrinho.billing,
      desconto_automatico: {
        centavos: carrinho.auto_discount_centavos || 0,
        motivo: carrinho.auto_discount_reason || null,
        upgrade_detectado: Boolean(carrinho.upgrade_detectado),
        plano_referencia: carrinho.plano_referencia_upgrade || null,
      },
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
        billing_name: carrinho.billing.billing_name,
        billing_cpf_cnpj: carrinho.billing.billing_cpf_cnpj,
        billing_phone: carrinho.billing.billing_phone,
        billing_cep: carrinho.billing.billing_cep,
        billing_logradouro: carrinho.billing.billing_logradouro,
        billing_numero: carrinho.billing.billing_numero,
        billing_complemento: carrinho.billing.billing_complemento,
        billing_bairro: carrinho.billing.billing_bairro,
        billing_cidade: carrinho.billing.billing_cidade,
        billing_uf: carrinho.billing.billing_uf,
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
    const checkoutMode = String(process.env.TAG_CHECKOUT_MODE || 'provider').trim().toLowerCase();
    if (checkoutMode === 'mock') {
      const mockUrl = `/tags/pagamentos/retorno?pedido_id=${pedido.id}&mock=1`;
      return TagProductOrder.atualizarCheckout(
        pedido.id,
        `MOCK-${Date.now()}-${pedido.id}`,
        mockUrl,
        null
      );
    }

    const orderNsu = infinitePayService.gerarOrderNsu('tag');
    const { redirectUrl, webhookUrl } = resolveCheckoutUrls(pedido.id);
    const descricao = pedido.order_type === 'assinatura_recorrente'
      ? `Assinatura TAG ${pedido.plan_slug}`
      : `TAG NFC (${pedido.quantidade_tags} unidade(s)) + assinatura ${pedido.plan_slug}`;

    const checkout = await infinitePayService.criarCheckoutLink({
      orderNsu,
      itens: [{ description: descricao, quantity: 1, price: pedido.total_centavos }],
      customer: {
        name: pedido.billing_name || usuario.nome,
        email: usuario.email,
        phone_number: normalizarPhoneNumber(pedido.billing_phone),
      },
      redirectUrl,
      webhookUrl,
    });

    return TagProductOrder.atualizarCheckout(
      pedido.id,
      checkout.order_nsu,
      checkout.checkout_url,
      checkout.invoice_slug
    );
  },

  async confirmarPagamentoNoRetorno({ pedido, transactionNsu, slug }) {
    if (!pedido || !pedido.infinitepay_order_nsu) {
      return { confirmado: false, motivo: 'pedido_sem_order_nsu' };
    }
    const check = await infinitePayService.checarPagamentoCheckout({
      orderNsu: pedido.infinitepay_order_nsu,
      transactionNsu: transactionNsu || pedido.transaction_nsu || null,
      slug: slug || pedido.invoice_slug || null,
    });
    if (!check.ok || !check.paid) {
      return { confirmado: false, motivo: check.status || 'nao_pago', check };
    }
    const payload = {
      order_nsu: pedido.infinitepay_order_nsu,
      transaction_nsu: check.transactionNsu || transactionNsu || pedido.transaction_nsu || null,
      amount: Number(pedido.total_centavos),
      payment_check: true,
      status: check.status || 'paid',
      raw_payment_check: check.raw || {},
    };
    const out = await this.processarPagamentoWebhook(payload);
    return { confirmado: true, check, out };
  },

  async processarPagamentoWebhook(payload) {
    await ensureTagCommerceSchema();
    const orderNsu = payload?.order_nsu || payload?.orderNsu;
    const transactionNsu = payload?.transaction_nsu || payload?.transactionNsu || null;
    if (!orderNsu) throw new Error('Webhook sem order_nsu.');

    const pedido = await TagProductOrder.buscarPorOrderNsu(orderNsu);
    if (!pedido) throw new Error('Pedido não encontrado para order_nsu informado.');
    const { valorPedidoCentavos, paidAmountCentavos } = extrairValoresWebhook(payload);
    const valorWebhook = Number.isFinite(valorPedidoCentavos)
      ? valorPedidoCentavos
      : extrairValorCentavosComFallback(payload);

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

    if (Number.isFinite(valorWebhook) && Number(valorWebhook) !== Number(pedido.total_centavos)) {
      throw new Error('Valor recebido no webhook diverge do total do pedido.');
    }
    if (!Number.isFinite(valorWebhook) && Number.isFinite(paidAmountCentavos)) {
      logger.warn('INFINITEPAY', `Webhook sem amount base comparável para order_nsu=${orderNsu}; paid_amount=${paidAmountCentavos}`);
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
