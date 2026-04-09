const TagProductOrder = require('../models/TagProductOrder');
const TagOrderUnit = require('../models/TagOrderUnit');
const PlanDefinition = require('../models/PlanDefinition');
const PromoCode = require('../models/PromoCode');
const Pet = require('../models/Pet');
const Usuario = require('../models/Usuario');
const tagCommerceService = require('../services/tagCommerceService');
const tagEntitlementService = require('../services/tagEntitlementService');
const tagOrderService = require('../domain/orders/tagOrderService');
const TagProductOrderEvent = require('../models/TagProductOrderEvent');
const logger = require('../utils/logger');
const { multerPublicUrl } = require('../middlewares/persistUploadMiddleware');
const { isSchemaMissingError } = require('../models/tagCommerceSchema');
const crypto = require('crypto');

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function tagCommerceHeadAssets() {
  return '<link rel="stylesheet" href="/css/tags-commerce.css">';
}

function scriptTag(src) {
  return `<script src="${src}"></script>`;
}

function serializePlanos(planos = [], planCopyMap = PLAN_COPY_MAP) {
  return (planos || []).map((plano) => {
    const ui = planCopyMap[plano.slug] || {};
    return {
      id: plano.id,
      slug: plano.slug,
      nome: plano.nome_plano || plano.nome || plano.nome_exibicao || plano.slug,
      nome_exibicao: plano.nome_exibicao || plano.nome_plano || plano.slug,
      descricao: plano.descricao || ui.subtitulo || ui.resumo || '',
      preco_centavos: Number(plano.preco_centavos || plano.preco || plano.mensalidade_centavos || 0),
      beneficios: Array.isArray(plano.beneficios_json) ? plano.beneficios_json : (ui.bullets || []),
      destaque: Boolean(plano.destaque || ui.destaque),
      badge: ui.badge || null,
      resumo: ui.resumo || null,
    };
  });
}

function redirecionarComFallbackSchema(req, res, redirectPath) {
  req.session.flash = {
    tipo: 'erro',
    mensagem: 'A área de pedidos TAG está em atualização no momento. Tente novamente em instantes.',
  };
  return res.redirect(redirectPath);
}

function limparTexto(value, max = 255) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.slice(0, max);
}

function parseIsoFimDoDia(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const base = new Date(`${yyyyMmDd}T23:59:59.999Z`);
  return Number.isNaN(base.getTime()) ? null : base.toISOString();
}

function parseIsoInicioDoDia(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const base = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  return Number.isNaN(base.getTime()) ? null : base.toISOString();
}

function assinaturaConfere(req, secret) {
  const assinaturaRaw = String(
    req.get('x-infinitepay-signature')
    || req.get('x-infinitypay-signature')
    || req.get('x-signature-hmac-sha256')
    || req.get('x-signature')
    || ''
  );
  if (!assinaturaRaw) return false;

  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {}));

  const assinatura = assinaturaRaw.replace(/^sha256=/i, '').trim();
  const secretBuffer = Buffer.from(String(secret));

  // Compatibilidade com configuração legada: assinatura igual ao segredo.
  try {
    const assinaturaBuffer = Buffer.from(assinatura);
    if (assinaturaBuffer.length === secretBuffer.length && crypto.timingSafeEqual(assinaturaBuffer, secretBuffer)) {
      return true;
    }
  } catch {
    // segue para a validação por HMAC
  }

  const hmacHex = crypto.createHmac('sha256', String(secret)).update(rawBody).digest('hex');
  const hmacB64 = crypto.createHmac('sha256', String(secret)).update(rawBody).digest('base64');
  const candidatos = [hmacHex, hmacB64, `sha256=${hmacHex}`, `sha256=${hmacB64}`];
  return candidatos.some((expected) => {
    try {
      const a = Buffer.from(assinaturaRaw.trim());
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

function clientIp(req) {
  return req.get('x-forwarded-for') || req.ip || req.socket?.remoteAddress || 'desconhecido';
}

function toReturnUrl(path, fallback = '/tags/pedidos') {
  if (typeof path !== 'string') return fallback;
  const clean = path.trim();
  if (clean.startsWith('/') && !clean.startsWith('//')) return clean;
  return fallback;
}

async function tentarConfirmarNoRetorno(req, pedido) {
  try {
    const confirmed = await tagCommerceService.confirmarPagamentoNoRetorno({
      pedido,
      transactionNsu: req.query.transaction_nsu || req.query.transactionNsu || null,
      slug: req.query.slug || req.query.invoice_slug || null,
    });
    return confirmed;
  } catch (err) {
    logger.warn('INFINITEPAY', `payment_check falhou pedido_id=${pedido.id} motivo=${err.message}`);
    return { confirmado: false, motivo: 'erro_payment_check' };
  }
}

const PLAN_COPY_MAP = {
  basico: {
    titulo: 'AIRPET Essencial',
    resumo: 'Contato direto para quem encontrar seu pet.',
    subtitulo: 'Para quem quer a tag funcionando com contato direto.',
    cta: 'Começar com o Essencial',
    badge: '',
    destaque: false,
    bullets: [
      'Perfil público com contato rápido.',
      'Ligar, enviar localização e "encontrei".',
      'Renovação soma +30 dias ao saldo.',
    ],
  },
  plus: {
    titulo: 'AIRPET Proteção',
    resumo: 'Visibilidade e apoio quando o pet sumir.',
    subtitulo: 'Para quem quer visibilidade e apoio quando o pet sumir.',
    cta: 'Proteger meu pet agora',
    badge: 'Mais escolhido',
    destaque: true,
    bullets: [
      'Tudo do Essencial.',
      'Alerta de pet perdido no mapa.',
      'Prioridade no momento crítico.',
    ],
  },
  familia: {
    titulo: 'AIRPET Rede',
    resumo: 'Rede de apoio completa com parceiros e multicanal.',
    subtitulo: 'Máxima rede de ajuda com parceiros e alertas em mais canais.',
    cta: 'Quero a rede completa',
    badge: '',
    destaque: false,
    bullets: [
      'Tudo do Proteção.',
      'Petshop parceiro sugerido.',
      'Notificações em mais canais.',
    ],
  },
};

function montarResumoUpgrade(contextoUpgrade, planos = []) {
  if (!contextoUpgrade || !contextoUpgrade.hasPaidOrder) return null;
  const referencia = (planos || []).find((p) => p.slug === contextoUpgrade.referencePlanSlug) || null;
  return {
    elegivel: true,
    descontoCentavos: 1000,
    descontoLabel: 'R$ 10,00',
    planoReferenciaSlug: contextoUpgrade.referencePlanSlug || null,
    planoReferenciaNome: referencia?.nome_exibicao || referencia?.slug || contextoUpgrade.referencePlanSlug || null,
  };
}

const tagCommerceController = {
  async mostrarLoja(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const planos = await tagCommerceService.carregarPlanos();
      const planQuery = String(req.query?.plan || '').trim().toLowerCase();
      const selectedPlanSlug = (planos || []).some((p) => p.slug === planQuery) ? planQuery : '';
      const usuario = req.session?.usuario || null;
      const pets = usuario ? await Pet.buscarPorUsuario(usuario.id) : [];
      const estadoPlano = usuario ? await tagEntitlementService.obterEstadoPlano(usuario.id) : null;
      const contextoUpgrade = usuario ? await tagCommerceService.obterContextoUpgrade(usuario.id, planos) : null;
      const upgradeResumo = montarResumoUpgrade(contextoUpgrade, planos);

      return res.render('tags/loja-tag', {
        titulo: 'Loja TAG AIRPET',
        planos,
        planCopyMap: PLAN_COPY_MAP,
        selectedPlanSlug,
        pets,
        estadoPlano,
        upgradeResumo,
        extraHead: tagCommerceHeadAssets(),
        extraScripts: scriptTag('/js/tags-loja.js'),
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
        billing: {
          billing_name: req.body.billing_name,
          billing_cpf_cnpj: req.body.billing_cpf_cnpj,
          billing_phone: req.body.billing_phone,
          billing_cep: req.body.billing_cep,
          billing_logradouro: req.body.billing_logradouro,
          billing_numero: req.body.billing_numero,
          billing_complemento: req.body.billing_complemento,
          billing_bairro: req.body.billing_bairro,
          billing_cidade: req.body.billing_cidade,
          billing_uf: req.body.billing_uf,
        },
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
        extraHead: tagCommerceHeadAssets(),
        extraScripts: scriptTag('/js/tags-pedidos.js'),
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
        extraHead: tagCommerceHeadAssets(),
        extraScripts: scriptTag('/js/tags-pedido-detalhe.js'),
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
    const ip = clientIp(req);
    try {
      const secret = process.env.INFINITEPAY_WEBHOOK_SECRET;
      if (secret && !assinaturaConfere(req, secret)) {
        logger.warn('INFINITEPAY', `Webhook rejeitado por assinatura inválida ip=${ip}`);
        return res.status(401).json({ ok: false, message: 'assinatura inválida' });
      }
      const out = await tagCommerceService.processarPagamentoWebhook(req.body || {});
      logger.info(
        'INFINITEPAY',
        `Webhook processado com sucesso ip=${ip} pedido_id=${out.pedido?.id || 'n/a'} ja_processado=${out.jaProcessado ? '1' : '0'}`
      );
      return res.json({ ok: true, pedido_id: out.pedido?.id, ja_processado: out.jaProcessado });
    } catch (err) {
      logger.warn(
        'INFINITEPAY',
        `Webhook falhou ip=${ip} status=500 detalhe=${String(err.message || 'erro_desconhecido').slice(0, 240)}`
      );
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
      const returnUrl = toReturnUrl(req.query.returnUrl, `/tags/pedidos/${pedidoId}`);
      const hasUser = Boolean(req.session?.usuario?.id);

      if (!hasUser) {
        const nextUrl = toReturnUrl(req.originalUrl, `/tags/pagamentos/retorno?pedido_id=${pedidoId}`);
        return res.redirect(`/auth/login?returnUrl=${encodeURIComponent(nextUrl)}`);
      }

      const pedido = await TagProductOrder.buscarPorIdEUsuario(pedidoId, req.session.usuario.id);
      if (!pedido) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pedido não encontrado para esta conta.' };
        return res.redirect('/tags/pedidos');
      }

      if (pedido.status !== 'pago') {
        const confirmacao = await tentarConfirmarNoRetorno(req, pedido);
        if (confirmacao.confirmado) {
          req.session.flash = {
            tipo: 'sucesso',
            mensagem: 'Pagamento confirmado e pedido atualizado com sucesso.',
          };
          return res.redirect(returnUrl);
        }
      }

      req.session.flash = {
        tipo: 'sucesso',
        mensagem: 'Retorno do pagamento recebido. Confira o status atualizado do seu pedido.',
      };
      return res.redirect(returnUrl);
    } catch (err) {
      logger.error('TagCommerceController', 'Erro no retorno de pagamento', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao confirmar retorno do pagamento.' };
      return res.redirect('/tags/pedidos');
    }
  },

  async mostrarPlanos(req, res) {
    const planos = await tagCommerceService.carregarPlanos();
    const usuario = req.session?.usuario || null;
    const contextoUpgrade = usuario ? await tagCommerceService.obterContextoUpgrade(usuario.id, planos) : null;
    const upgradeResumo = montarResumoUpgrade(contextoUpgrade, planos);
    return res.render('tags/planos', {
      titulo: 'Planos TAG',
      planos,
      planCopyMap: PLAN_COPY_MAP,
      upgradeResumo,
      extraHead: tagCommerceHeadAssets(),
      extraScripts: scriptTag('/js/tags-planos.js'),
    });
  },

  async apiListarPlanos(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const planos = await tagCommerceService.carregarPlanos();
      return res.json({ ok: true, planos: serializePlanos(planos) });
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao listar planos via API', err);
      return res.status(500).json({ ok: false, message: 'Erro ao listar planos.' });
    }
  },

  async assinarPlano(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const usuarioId = req.session.usuario.id;
      const payload = {
        plan_slug: req.body.plan_slug,
        order_type: 'assinatura_recorrente',
        quantidade_tags: 0,
        pet_ids: [],
        promo_code: req.body.promo_code,
        billing: {
          billing_name: req.body.billing_name,
          billing_cpf_cnpj: req.body.billing_cpf_cnpj,
          billing_phone: req.body.billing_phone,
          billing_cep: req.body.billing_cep,
          billing_logradouro: req.body.billing_logradouro,
          billing_numero: req.body.billing_numero,
          billing_complemento: req.body.billing_complemento,
          billing_bairro: req.body.billing_bairro,
          billing_cidade: req.body.billing_cidade,
          billing_uf: req.body.billing_uf,
        },
      };
      const { pedido } = await tagCommerceService.criarPedido(usuarioId, payload);
      const usuario = await Usuario.buscarPorId(usuarioId);
      const checkout = await tagCommerceService.criarCheckout(usuario, pedido);
      if (req.xhr || String(req.get('accept') || '').includes('application/json')) {
        return res.status(201).json({
          ok: true,
          pedido_id: pedido.id,
          checkout_url: checkout?.checkout_url || null,
        });
      }
      if (checkout.checkout_url) return res.redirect(checkout.checkout_url);
      req.session.flash = { tipo: 'sucesso', mensagem: 'Assinatura criada com sucesso.' };
      return res.redirect(`/tags/pedidos/${pedido.id}`);
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao criar assinatura TAG', err);
      if (req.xhr || String(req.get('accept') || '').includes('application/json')) {
        return res.status(400).json({ ok: false, message: err.message || 'Não foi possível assinar o plano.' });
      }
      req.session.flash = { tipo: 'erro', mensagem: err.message || 'Não foi possível assinar o plano.' };
      return res.redirect('/tags/planos');
    }
  },

  async adminListarPedidos(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const filtros = {
        status: limparTexto(req.query.status, 30),
        plan_slug: limparTexto(req.query.plan_slug, 50),
        data_inicio: parseIsoInicioDoDia(req.query.data_inicio),
        data_fim: parseIsoFimDoDia(req.query.data_fim),
      };
      const [pedidos, resumo, planos] = await Promise.all([
        TagProductOrder.listarAdmin(filtros),
        TagProductOrder.obterResumoAdmin(filtros),
        PlanDefinition.listarAtivos(),
      ]);

      return res.render('admin/tag-commerce-pedidos', {
        titulo: 'Comércio TAG - Pedidos',
        pedidos,
        resumo,
        planos,
        filtros: {
          status: filtros.status || '',
          plan_slug: filtros.plan_slug || '',
          data_inicio: limparTexto(req.query.data_inicio, 20),
          data_fim: limparTexto(req.query.data_fim, 20),
        },
        adminPath: process.env.ADMIN_PATH || '/admin',
        currentPath: '/tags-commerce',
        statusLabels: tagOrderService.STATUS_LABELS,
      });
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao listar pedidos admin TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar painel de pedidos TAG.' };
      return res.redirect('/tags/admin/lista');
    }
  },

  async adminDetalhePedido(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const pedidoId = Number(req.params.id);
      const pedido = await TagProductOrder.buscarPorIdAdmin(pedidoId);
      if (!pedido) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pedido não encontrado.' };
        return res.redirect('/tags/admin/commerce/pedidos');
      }
      const unidades = await TagOrderUnit.listarPorPedido(pedido.id);
      const eventos = await TagProductOrderEvent.listarPorPedido(pedido.id);
      return res.render('admin/tag-commerce-pedido-detalhe', {
        titulo: `Pedido TAG #${pedido.id}`,
        pedido,
        unidades,
        eventos,
        statusLabels: tagOrderService.STATUS_LABELS,
        adminPath: process.env.ADMIN_PATH || '/admin',
        currentPath: '/tags-commerce',
      });
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao abrir detalhe do pedido admin TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar detalhe do pedido TAG.' };
      return res.redirect('/tags/admin/commerce/pedidos');
    }
  },

  async adminSalvarNotaFiscal(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const pedidoId = Number(req.params.id);
      const emitidaEm = req.body.nfe_emitida_em ? new Date(req.body.nfe_emitida_em) : null;
      if (emitidaEm && Number.isNaN(emitidaEm.getTime())) {
        throw new Error('Data de emissão da nota fiscal inválida.');
      }
      await TagProductOrder.atualizarNotaFiscal(pedidoId, {
        nfe_numero: limparTexto(req.body.nfe_numero, 40),
        nfe_chave: limparTexto(req.body.nfe_chave, 64),
        nfe_url_pdf: limparTexto(req.body.nfe_url_pdf, 500),
        nfe_emitida_em: emitidaEm ? emitidaEm.toISOString() : null,
        admin_nf_obs: limparTexto(req.body.admin_nf_obs, 2000),
      });
      req.session.flash = { tipo: 'sucesso', mensagem: 'Dados de nota fiscal atualizados.' };
      return res.redirect(`/tags/admin/commerce/pedidos/${pedidoId}`);
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao salvar NF do pedido TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: err.message || 'Não foi possível salvar a nota fiscal.' };
      return res.redirect(`/tags/admin/commerce/pedidos/${req.params.id}`);
    }
  },

  async adminAtualizarStatusPedido(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const pedidoId = Number(req.params.id);
      const proximoStatus = limparTexto(req.body.status, 30);
      const nota = limparTexto(req.body.nota_status, 500);
      const atualizado = await tagOrderService.atualizarStatus(
        pedidoId,
        proximoStatus,
        null,
        nota || null
      );
      req.session.flash = {
        tipo: 'sucesso',
        mensagem: `Pedido #${atualizado.id} atualizado para ${tagOrderService.toLabel(atualizado.status)}.`,
      };
      return res.redirect(`/tags/admin/commerce/pedidos/${pedidoId}`);
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao atualizar status do pedido TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: err.message || 'Não foi possível atualizar o status do pedido.' };
      return res.redirect(`/tags/admin/commerce/pedidos/${req.params.id}`);
    }
  },

  async adminListarCupons(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const cupons = await PromoCode.listarAdmin();
      return res.render('admin/tag-commerce-cupons', {
        titulo: 'Comércio TAG - Cupons',
        cupons,
        adminPath: process.env.ADMIN_PATH || '/admin',
        currentPath: '/tags-commerce-coupons',
      });
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao listar cupons TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar cupons.' };
      return res.redirect('/tags/admin/commerce/pedidos');
    }
  },

  async adminCriarCupom(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      await PromoCode.criarAdmin({
        codigo: limparTexto(req.body.codigo, 40).toUpperCase(),
        tipo: limparTexto(req.body.tipo, 20) === 'fixo' ? 'fixo' : 'percentual',
        valor: Number(req.body.valor || 0),
        ativo: req.body.ativo === 'on',
        valid_from: req.body.valid_from ? new Date(req.body.valid_from).toISOString() : null,
        valid_until: req.body.valid_until ? new Date(req.body.valid_until).toISOString() : null,
        max_usos_global: req.body.max_usos_global ? Number(req.body.max_usos_global) : null,
        max_usos_por_usuario: req.body.max_usos_por_usuario ? Number(req.body.max_usos_por_usuario) : null,
      });
      req.session.flash = { tipo: 'sucesso', mensagem: 'Cupom criado com sucesso.' };
      return res.redirect('/tags/admin/commerce/cupons');
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao criar cupom TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: err.message || 'Erro ao criar cupom.' };
      return res.redirect('/tags/admin/commerce/cupons');
    }
  },

  async adminAtualizarCupom(req, res) {
    try {
      await tagCommerceService.ensurePedidosSchema();
      const cupomId = Number(req.params.id);
      await PromoCode.atualizarAdmin(cupomId, {
        ativo: req.body.ativo === 'on',
        valid_from: req.body.valid_from ? new Date(req.body.valid_from).toISOString() : null,
        valid_until: req.body.valid_until ? new Date(req.body.valid_until).toISOString() : null,
        max_usos_global: req.body.max_usos_global ? Number(req.body.max_usos_global) : null,
        max_usos_por_usuario: req.body.max_usos_por_usuario ? Number(req.body.max_usos_por_usuario) : null,
      });
      req.session.flash = { tipo: 'sucesso', mensagem: 'Cupom atualizado.' };
      return res.redirect('/tags/admin/commerce/cupons');
    } catch (err) {
      logger.error('TagCommerceController', 'Erro ao atualizar cupom TAG', err);
      req.session.flash = { tipo: 'erro', mensagem: err.message || 'Erro ao atualizar cupom.' };
      return res.redirect('/tags/admin/commerce/cupons');
    }
  },
};

module.exports = tagCommerceController;
