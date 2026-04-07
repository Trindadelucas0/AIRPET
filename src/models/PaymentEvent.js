const { query } = require('../config/database');

const PaymentEvent = {
  async registrar(dados) {
    const r = await query(
      `INSERT INTO payment_events
        (order_id, usuario_id, provider, event_type, order_nsu, transaction_nsu, status, payload_json)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        dados.order_id || null,
        dados.usuario_id || null,
        dados.provider || 'infinitepay',
        dados.event_type || 'unknown',
        dados.order_nsu || null,
        dados.transaction_nsu || null,
        dados.status || 'received',
        JSON.stringify(dados.payload_json || {}),
      ]
    );
    return r.rows[0] || null;
  },
};

module.exports = PaymentEvent;
