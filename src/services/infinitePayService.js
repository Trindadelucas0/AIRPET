const crypto = require('crypto');
const logger = require('../utils/logger');

const API_BASE = process.env.INFINITEPAY_API_BASE || 'https://api.infinitepay.io';
const CHECKOUT_PATH = '/invoices/public/checkout/links';
const PAYMENT_CHECK_PATH = '/invoices/public/checkout/payment_check';

function centavosToNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeHandle(rawHandle) {
  const base = String(rawHandle || '').trim();
  if (!base) return '';
  return base.startsWith('$') ? base.slice(1) : base;
}

function sanitizeCustomer(customer) {
  if (!customer || typeof customer !== 'object') return undefined;
  const out = {};
  if (customer.name) out.name = String(customer.name).trim();
  if (customer.email) out.email = String(customer.email).trim();
  if (customer.phone_number) out.phone_number = String(customer.phone_number).trim();
  if (customer.phone) out.phone = String(customer.phone).trim();
  return Object.keys(out).length ? out : undefined;
}

function sanitizeUrlForLogs(raw) {
  try {
    const u = new URL(String(raw || ''));
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return String(raw || '');
  }
}

function parseResponseTextAsJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw_text: text };
  }
}

async function postCheckout({ payload, token, withAuth }) {
  const headers = { 'Content-Type': 'application/json' };
  if (withAuth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${CHECKOUT_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = parseResponseTextAsJson(text);

  return { response, data };
}

async function postPaymentCheck({ payload, token, withAuth }) {
  const headers = { 'Content-Type': 'application/json' };
  if (withAuth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${PAYMENT_CHECK_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = parseResponseTextAsJson(text);
  return { response, data };
}

function inferPaidState(data) {
  const statusCandidates = [
    data?.status,
    data?.payment_status,
    data?.invoice_status,
    data?.payment?.status,
    data?.data?.status,
  ].filter(Boolean).map((v) => String(v).trim().toLowerCase());

  const paidFlags = [
    data?.paid,
    data?.is_paid,
    data?.payment?.paid,
    data?.data?.paid,
  ];

  const paidByFlag = paidFlags.some((v) => v === true || v === 'true' || v === 1 || v === '1');
  const paidByStatus = statusCandidates.some((s) => (
    s.includes('paid')
    || s.includes('approved')
    || s.includes('confirm')
    || s.includes('complete')
    || s.includes('success')
    || s === 'done'
  ));

  const transactionNsu = (
    data?.transaction_nsu
    || data?.transactionNsu
    || data?.payment?.transaction_nsu
    || data?.payment?.transactionNsu
    || data?.data?.transaction_nsu
    || data?.data?.transactionNsu
    || null
  );

  return {
    paid: Boolean(paidByFlag || paidByStatus),
    transactionNsu,
    status: statusCandidates[0] || null,
  };
}

const infinitePayService = {
  gerarOrderNsu(prefixo = 'tag') {
    return `${prefixo}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  },

  async criarCheckoutLink({ orderNsu, itens, customer, redirectUrl, webhookUrl }) {
    const handle = normalizeHandle(process.env.INFINITEPAY_HANDLE);
    const token = process.env.INFINITEPAY_TOKEN;
    if (!handle) {
      logger.warn('INFINITEPAY', 'INFINITEPAY_HANDLE não configurado; retornando checkout mock para desenvolvimento.');
      return {
        order_nsu: orderNsu,
        checkout_url: `${redirectUrl}?paid=0&mock=1&order_nsu=${encodeURIComponent(orderNsu)}`,
        invoice_slug: `mock-${orderNsu}`,
        raw: { mock: true },
      };
    }

    const mappedItens = (itens || []).map((i) => ({
      description: i.description,
      quantity: Number(i.quantity || 1),
      price: centavosToNumber(i.price),
    }));
    const basePayload = {
      handle,
      order_nsu: orderNsu,
      customer: sanitizeCustomer(customer),
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
    };

    const tentativas = [
      { nome: 'itens+auth', payload: { ...basePayload, itens: mappedItens }, withAuth: Boolean(token) },
      { nome: 'items+auth', payload: { ...basePayload, items: mappedItens }, withAuth: Boolean(token) },
      { nome: 'items-noauth', payload: { ...basePayload, items: mappedItens }, withAuth: false },
      { nome: 'itens-noauth', payload: { ...basePayload, itens: mappedItens }, withAuth: false },
    ];

    let lastError = null;
    for (const tentativa of tentativas) {
      if (!token && tentativa.withAuth) continue;

      const { response, data } = await postCheckout({
        payload: tentativa.payload,
        token,
        withAuth: tentativa.withAuth,
      });

      if (response.ok) {
        return {
          order_nsu: data.order_nsu || orderNsu,
          checkout_url: data.checkout_url || data.url || null,
          invoice_slug: data.invoice_slug || data.slug || null,
          raw: data,
        };
      }

      lastError = {
        status: response.status,
        data,
        tentativa: tentativa.nome,
      };
      const resumoErro = (
        data?.message
        || data?.error
        || data?.details
        || data?.raw_text
        || 'sem detalhe'
      );
      logger.warn(
        'INFINITEPAY',
        `Falha ao criar checkout (${tentativa.nome}) status=${response.status} order_nsu=${orderNsu} redirect_url=${sanitizeUrlForLogs(redirectUrl)} webhook_url=${sanitizeUrlForLogs(webhookUrl)} detalhe=${String(resumoErro).slice(0, 240)}`
      );
    }

    const err = new Error(
      lastError?.data?.message
      || lastError?.data?.error
      || `Erro ao criar checkout InfinitePay (status ${lastError?.status || 'desconhecido'}).`
    );
    err.httpStatus = lastError?.status || 500;
    err.details = lastError?.data || {};
    err.tentativa = lastError?.tentativa || null;
    throw err;
  },

  async checarPagamentoCheckout({ orderNsu, transactionNsu, slug }) {
    const handle = normalizeHandle(process.env.INFINITEPAY_HANDLE);
    if (!handle) {
      return {
        ok: false,
        paid: false,
        status: 'handle_missing',
        source: 'local',
        raw: { message: 'INFINITEPAY_HANDLE não configurado.' },
      };
    }

    const token = process.env.INFINITEPAY_TOKEN;
    const basePayload = {
      handle,
      order_nsu: orderNsu,
      transaction_nsu: transactionNsu || undefined,
      slug: slug || undefined,
    };

    const tentativas = [
      { nome: 'order+slug+auth', payload: { ...basePayload }, withAuth: Boolean(token) },
      { nome: 'order+slug-noauth', payload: { ...basePayload }, withAuth: false },
      { nome: 'order-only-auth', payload: { handle, order_nsu: orderNsu }, withAuth: Boolean(token) },
      { nome: 'order-only-noauth', payload: { handle, order_nsu: orderNsu }, withAuth: false },
    ];

    let lastError = null;
    for (const tentativa of tentativas) {
      if (!token && tentativa.withAuth) continue;
      const { response, data } = await postPaymentCheck({
        payload: tentativa.payload,
        token,
        withAuth: tentativa.withAuth,
      });
      if (response.ok) {
        const paidState = inferPaidState(data);
        return {
          ok: true,
          paid: paidState.paid,
          status: paidState.status,
          transactionNsu: paidState.transactionNsu,
          source: tentativa.nome,
          raw: data,
        };
      }
      lastError = { status: response.status, data, tentativa: tentativa.nome };
      logger.warn(
        'INFINITEPAY',
        `Falha payment_check (${tentativa.nome}) status=${response.status} order_nsu=${orderNsu} detalhe=${String(data?.message || data?.error || data?.raw_text || 'sem detalhe').slice(0, 240)}`
      );
    }

    return {
      ok: false,
      paid: false,
      status: `http_${lastError?.status || 'unknown'}`,
      source: lastError?.tentativa || null,
      raw: lastError?.data || {},
    };
  },
};

module.exports = infinitePayService;
