const { query, withTransaction } = require('../config/database');
const { ensureTagCommerceSchema } = require('./tagCommerceSchema');

const TagProductOrder = {
  async ensureSchema() {
    await ensureTagCommerceSchema();
  },

  async criarComUnidades(dados, unidades) {
    await ensureTagCommerceSchema();
    return withTransaction(async (client) => {
      const orderRes = await client.query(
        `INSERT INTO tag_product_orders
          (usuario_id, plan_slug, order_type, status, quantidade_tags, subtotal_centavos, desconto_centavos, total_centavos, promo_code, petshop_id, snapshot_json)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
         RETURNING *`,
        [
          dados.usuario_id,
          dados.plan_slug,
          dados.order_type,
          dados.status || 'aguardando_pagamento',
          dados.quantidade_tags || 0,
          dados.subtotal_centavos || 0,
          dados.desconto_centavos || 0,
          dados.total_centavos || 0,
          dados.promo_code || null,
          dados.petshop_id || null,
          JSON.stringify(dados.snapshot_json || {}),
        ]
      );
      const pedido = orderRes.rows[0];

      for (const unidade of (unidades || [])) {
        await client.query(
          `INSERT INTO tag_order_units
            (order_id, sequencia, pet_id, print_photo_url, personalization_status)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            pedido.id,
            unidade.sequencia,
            unidade.pet_id || null,
            unidade.print_photo_url || null,
            unidade.personalization_status || 'pendente',
          ]
        );
      }

      return pedido;
    });
  },

  async atualizarCheckout(orderId, orderNsu, checkoutUrl, invoiceSlug) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_product_orders
       SET infinitepay_order_nsu = $2,
           checkout_url = $3,
           invoice_slug = $4,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, orderNsu, checkoutUrl || null, invoiceSlug || null]
    );
    return r.rows[0] || null;
  },

  async buscarPorOrderNsu(orderNsu) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT * FROM tag_product_orders WHERE infinitepay_order_nsu = $1 LIMIT 1`,
      [orderNsu]
    );
    return r.rows[0] || null;
  },

  async marcarPago(orderId, transactionNsu) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_product_orders
       SET status = 'pago',
           transaction_nsu = COALESCE($2, transaction_nsu),
           paid_at = COALESCE(paid_at, NOW()),
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, transactionNsu || null]
    );
    return r.rows[0] || null;
  },

  async buscarPorIdEUsuario(orderId, usuarioId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT o.*
       FROM tag_product_orders o
       WHERE o.id = $1 AND o.usuario_id = $2`,
      [orderId, usuarioId]
    );
    return r.rows[0] || null;
  },

  async listarPorUsuario(usuarioId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT *
       FROM tag_product_orders
       WHERE usuario_id = $1
       ORDER BY data_criacao DESC
       LIMIT 100`,
      [usuarioId]
    );
    return r.rows;
  },
};

module.exports = TagProductOrder;
