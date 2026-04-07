const { query } = require('../config/database');

const PromoCode = {
  async buscarPorCodigo(codigo) {
    const r = await query(
      `SELECT *
       FROM promo_codes
       WHERE UPPER(codigo) = UPPER($1)
       LIMIT 1`,
      [codigo]
    );
    return r.rows[0] || null;
  },

  async contarUsos(promoCodeId, usuarioId) {
    const r = await query(
      `SELECT
         COUNT(*)::int AS usos_total,
         COUNT(*) FILTER (WHERE usuario_id = $2)::int AS usos_usuario
       FROM promo_code_redemptions
       WHERE promo_code_id = $1`,
      [promoCodeId, usuarioId]
    );
    return r.rows[0] || { usos_total: 0, usos_usuario: 0 };
  },

  async registrarUso(promoCodeId, usuarioId, orderId, descontoCentavos) {
    await query(
      `INSERT INTO promo_code_redemptions
        (promo_code_id, usuario_id, order_id, desconto_centavos)
       VALUES ($1, $2, $3, $4)`,
      [promoCodeId, usuarioId, orderId, descontoCentavos || 0]
    );
  },
};

module.exports = PromoCode;
