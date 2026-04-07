const crypto = require('crypto');
const logger = require('../utils/logger');

const API_BASE = process.env.INFINITEPAY_API_BASE || 'https://api.infinitepay.io';
const CHECKOUT_PATH = '/invoices/public/checkout/links';

function centavosToNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

const infinitePayService = {
  gerarOrderNsu(prefixo = 'tag') {
    return `${prefixo}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  },

  async criarCheckoutLink({ orderNsu, itens, customer, redirectUrl, webhookUrl }) {
    const token = process.env.INFINITEPAY_TOKEN;
    if (!token) {
      logger.warn('INFINITEPAY', 'INFINITEPAY_TOKEN não configurado; retornando checkout mock para desenvolvimento.');
      return {
        order_nsu: orderNsu,
        checkout_url: `${redirectUrl}?paid=0&mock=1&order_nsu=${encodeURIComponent(orderNsu)}`,
        invoice_slug: `mock-${orderNsu}`,
        raw: { mock: true },
      };
    }

    const payload = {
      order_nsu: orderNsu,
      items: (itens || []).map((i) => ({
        description: i.description,
        quantity: Number(i.quantity || 1),
        price: centavosToNumber(i.price),
      })),
      customer: customer || undefined,
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
    };

    const response = await fetch(`${API_BASE}${CHECKOUT_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw_text: text };
    }

    if (!response.ok) {
      const err = new Error(data?.message || 'Erro ao criar checkout InfinitePay.');
      err.httpStatus = response.status;
      err.details = data;
      throw err;
    }

    return {
      order_nsu: data.order_nsu || orderNsu,
      checkout_url: data.checkout_url || data.url || null,
      invoice_slug: data.invoice_slug || data.slug || null,
      raw: data,
    };
  },
};

module.exports = infinitePayService;
