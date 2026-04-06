/**
 * Token opaco (HMAC) para GET /parceiros/status/:id — evita enumeração sem o link completo.
 * Segredo: PARTNER_STATUS_SECRET ou, em fallback, JWT_SECRET (já obrigatório no servidor).
 */

const crypto = require('crypto');

function secretKey() {
  return (
    process.env.PARTNER_STATUS_SECRET ||
    process.env.JWT_SECRET ||
    ''
  );
}

function sign(requestId) {
  const id = String(requestId);
  const key = secretKey();
  if (!key) return '';
  return crypto.createHmac('sha256', key).update(`parceiro_status:${id}`).digest('base64url');
}

function verify(requestId, token) {
  const key = secretKey();
  if (!key || requestId == null || token == null || String(token).trim() === '') return false;
  const expected = crypto.createHmac('sha256', key).update(`parceiro_status:${String(requestId)}`).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token).trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };
