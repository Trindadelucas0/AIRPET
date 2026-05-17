/**
 * PasswordResetToken — persistência de tokens de recuperação de senha.
 *
 * Guardamos apenas o hash SHA-256 do token (nunca o valor cru), para que um
 * dump do banco não comprometa contas. O token "puro" só existe na memória
 * do processo durante a geração e no email enviado ao usuário.
 */

const crypto = require('crypto');
const { query } = require('../config/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

const PasswordResetToken = {
  hashToken,

  async criar({ usuarioId, token, ttlMs, ipOrigem }) {
    const tokenHash = hashToken(token);
    const expiraEm = new Date(Date.now() + Math.max(60_000, Number(ttlMs) || 3_600_000));
    const r = await query(
      `INSERT INTO password_reset_tokens (usuario_id, token_hash, expira_em, ip_origem)
       VALUES ($1, $2, $3, $4)
       RETURNING id, criado_em, expira_em`,
      [usuarioId, tokenHash, expiraEm, ipOrigem || null]
    );
    return r.rows[0];
  },

  async buscarValido(token) {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const r = await query(
      `SELECT id, usuario_id, expira_em, usado_em
       FROM password_reset_tokens
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
      `UPDATE password_reset_tokens
       SET usado_em = NOW()
       WHERE token_hash = $1 AND usado_em IS NULL`,
      [tokenHash]
    );
  },

  /** Invalida quaisquer tokens ativos de um usuário (ex.: pedido de novo link). */
  async invalidarPendentesDoUsuario(usuarioId) {
    await query(
      `UPDATE password_reset_tokens
       SET usado_em = NOW()
       WHERE usuario_id = $1 AND usado_em IS NULL`,
      [usuarioId]
    );
  },

  /** Job de manutenção opcional: remove tokens expirados há mais de 7 dias. */
  async limparAntigos() {
    await query(
      `DELETE FROM password_reset_tokens
       WHERE expira_em < NOW() - INTERVAL '7 days'`
    );
  },
};

module.exports = PasswordResetToken;
