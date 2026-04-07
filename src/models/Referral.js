const { query } = require('../config/database');

const Referral = {
  async buscarPorCodigo(codigo) {
    const r = await query(
      `SELECT * FROM referrals WHERE UPPER(codigo) = UPPER($1) LIMIT 1`,
      [codigo]
    );
    return r.rows[0] || null;
  },

  async criarParaUsuarioSeNaoExistir(usuarioId, codigo) {
    const r = await query(
      `INSERT INTO referrals (usuario_id, codigo)
       VALUES ($1, $2)
       ON CONFLICT (codigo) DO NOTHING
       RETURNING *`,
      [usuarioId, codigo]
    );
    return r.rows[0] || null;
  },

  async registrarCredito(referrerUsuarioId, referredUsuarioId, orderId, tipoCredito, valorCentavos, diasCredito) {
    const r = await query(
      `INSERT INTO referral_credits
        (referrer_usuario_id, referred_usuario_id, order_id, tipo_credito, valor_centavos, dias_credito, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendente')
       ON CONFLICT (referrer_usuario_id, referred_usuario_id, order_id)
       DO NOTHING
       RETURNING *`,
      [referrerUsuarioId, referredUsuarioId, orderId || null, tipoCredito || 'valor', valorCentavos || 0, diasCredito || 0]
    );
    return r.rows[0] || null;
  },
};

module.exports = Referral;
