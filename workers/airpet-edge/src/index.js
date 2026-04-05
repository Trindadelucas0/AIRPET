/**
 * SlotProxy: cada instância Durable Object processa um pedido de cada vez.
 * O Worker distribui por hash entre SLOT_COUNT instâncias → até N pedidos em paralelo ao origin.
 */
export class SlotProxy {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const origin = (this.env.ORIGIN_BASE_URL || '').replace(/\/$/, '');
    if (!origin) {
      return new Response('ORIGIN_BASE_URL not configured', { status: 500 });
    }
    const u = new URL(request.url);
    const dest = origin + u.pathname + u.search;
    const headers = new Headers(request.headers);
    ['cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-ew-via'].forEach((h) => headers.delete(h));
    return fetch(dest, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });
  }
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default {
  async fetch(request, env) {
    const max = Math.min(Math.max(parseInt(env.SLOT_COUNT || '10', 10), 1), 100);
    const idx = hashString(request.url + (request.headers.get('cf-connecting-ip') || '')) % max;
    const id = env.SLOT.idFromName('slot-' + idx);
    const stub = env.SLOT.get(id);
    const u = new URL(request.url);
    const internalUrl = 'https://slot.internal' + u.pathname + u.search;
    return stub.fetch(new Request(internalUrl, request));
  },

  async queue(batch, env) {
    const url = env.WEBHOOK_URL;
    const secret = env.WEBHOOK_SECRET;
    if (!url || !secret) return;
    const messages = batch.messages.map((m) => {
      try {
        if (typeof m.body === 'string') return JSON.parse(m.body);
        return m.body;
      } catch {
        return m.body;
      }
    });
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Airpet-Webhook-Secret': secret,
      },
      body: JSON.stringify({ messages }),
    });
  },
};
