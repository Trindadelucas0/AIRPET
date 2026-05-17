/**
 * EmailVerification — verificação de e-mail do usuário no cadastro.
 *
 * Guardamos hash SHA-256 do token; o token cru só sai no e-mail enviado.
 * Ao confirmar, marca `usuarios.email_verificado_em = NOW()` (na transição,
 * o controller é quem aciona o UPDATE no usuário; este model trata só do token).
 */

const crypto = require('crypto');
const { query } = require('../config/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

const EmailVerification = {
  hashToken,

  async criar({ usuarioId, email, token, ttlMs }) {
    const tokenHash = hashToken(token);
    const expiraEm = new Date(Date.now() + Math.max(60_000, Number(ttlMs) || 86_400_000));
    const r = await query(
      `INSERT INTO email_verifications (usuario_id, email, token_hash, expira_em)
       VALUES ($1, $2, $3, $4)
       RETURNING id, criado_em, expira_em`,
      [usuarioId, String(email).trim().toLowerCase(), tokenHash, expiraEm]
    );
    return r.rows[0];
  },

  async buscarValido(token) {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const r = await query(
      `SELECT id, usuario_id, email, expira_em, usado_em
       FROM email_verifications
       WHERE token_hash = $1
         AND usado_em IS NULL
         AND expira_em > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    return r.rows[0] || null;
  },

  async marcarComoUsado(token) {
    const tokenHash = hashToken(token);
    await query(
      `UPDATE email_verifications
       SET usado_em = NOW()
       WHERE token_hash = $1 AND usado_em IS NULL`,
      [tokenHash]
    );
  },

  async invalidarPendentesDoUsuario(usuarioId) {
    await query(
      `UPDATE email_verifications
       SET usado_em = NOW()
       WHERE usuario_id = $1 AND usado_em IS NULL`,
      [usuarioId]
    );
  },
};

module.exports = EmailVerification;
