const crypto = require('crypto');
const logger = require('../utils/logger');

const API_BASE = process.env.INFINITEPAY_API_BASE || 'https://api.infinitepay.io';
const CHECKOUT_PATH = '/invoices/public/checkout/links';

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

async function postCheckout({ payload, token, withAuth }) {
  const headers = { 'Content-Type': 'application/json' };
  if (withAuth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${CHECKOUT_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw_text: text };
  }

  return { response, data };
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
      logger.warn('INFINITEPAY', `Falha ao criar checkout (${tentativa.nome}) status=${response.status}`);
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
};

module.exports = infinitePayService;
