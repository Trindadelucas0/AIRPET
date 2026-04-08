const { query } = require('../config/database');

const TagProductOrderEvent = {
  async registrar({
    order_id,
    from_status = null,
    to_status,
    actor_admin_id = null,
    nota = null,
  }, client = null) {
    const executor = client || { query };
    const resultado = await executor.query(
      `INSERT INTO tag_product_order_events
        (order_id, from_status, to_status, actor_admin_id, nota)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [order_id, from_status, to_status, actor_admin_id, nota]
    );
    return resultado.rows[0] || null;
  },

  async listarPorPedido(orderId) {
    const resultado = await query(
      `SELECT *
       FROM tag_product_order_events
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [orderId]
    );
    return resultado.rows;
  },
};

module.exports = TagProductOrderEvent;
