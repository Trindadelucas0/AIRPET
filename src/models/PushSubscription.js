const { query } = require('../config/database');

const PushSubscription = {

  async salvar(usuarioId, subscription, userAgent) {
    const { endpoint } = subscription;
    const { p256dh, auth } = subscription.keys;

    const resultado = await query(
      `INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET
         usuario_id = EXCLUDED.usuario_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent
       RETURNING *`,
      [usuarioId, endpoint, p256dh, auth, userAgent || null]
    );

    return resultado.rows[0];
  },

  async remover(endpoint) {
    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  },

  async removerPorId(id) {
    await query('DELETE FROM push_subscriptions WHERE id = $1', [id]);
  },

  async buscarPorUsuario(usuarioId) {
    const resultado = await query(
      'SELECT * FROM push_subscriptions WHERE usuario_id = $1',
      [usuarioId]
    );
    return resultado.rows;
  },

  async buscarPorUsuarios(usuarioIds) {
    if (!usuarioIds || usuarioIds.length === 0) return [];
    const resultado = await query(
      'SELECT * FROM push_subscriptions WHERE usuario_id = ANY($1::int[])',
      [usuarioIds]
    );
    return resultado.rows;
  },

  async buscarTodas() {
    const resultado = await query('SELECT * FROM push_subscriptions');
    return resultado.rows;
  },
};

module.exports = PushSubscription;
