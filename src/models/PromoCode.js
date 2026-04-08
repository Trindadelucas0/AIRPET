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

  async listarAdmin() {
    const r = await query(
      `SELECT *
       FROM promo_codes
       ORDER BY data_criacao DESC
       LIMIT 200`
    );
    return r.rows;
  },

  async criarAdmin(dados) {
    if (!dados.codigo) throw new Error('Código do cupom é obrigatório.');
    if (!Number.isFinite(dados.valor) || dados.valor <= 0) throw new Error('Valor do cupom inválido.');

    const r = await query(
      `INSERT INTO promo_codes
        (codigo, tipo, valor, ativo, valid_from, valid_until, max_usos_global, max_usos_por_usuario)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dados.codigo,
        dados.tipo === 'fixo' ? 'fixo' : 'percentual',
        Number(dados.valor),
        Boolean(dados.ativo),
        dados.valid_from || null,
        dados.valid_until || null,
        Number.isFinite(dados.max_usos_global) ? dados.max_usos_global : null,
        Number.isFinite(dados.max_usos_por_usuario) ? dados.max_usos_por_usuario : null,
      ]
    );
    return r.rows[0] || null;
  },

  async atualizarAdmin(cupomId, dados) {
    const r = await query(
      `UPDATE promo_codes
       SET ativo = $2,
           valid_from = $3,
           valid_until = $4,
           max_usos_global = $5,
           max_usos_por_usuario = $6
       WHERE id = $1
       RETURNING *`,
      [
        cupomId,
        Boolean(dados.ativo),
        dados.valid_from || null,
        dados.valid_until || null,
        Number.isFinite(dados.max_usos_global) ? dados.max_usos_global : null,
        Number.isFinite(dados.max_usos_por_usuario) ? dados.max_usos_por_usuario : null,
      ]
    );
    return r.rows[0] || null;
  },
};

module.exports = PromoCode;
