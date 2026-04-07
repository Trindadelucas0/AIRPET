const { query } = require('../config/database');

const DEFAULT_GRACE_HOURS = parseInt(process.env.TAG_SUBSCRIPTION_GRACE_HOURS || '72', 10);

const TagSubscription = {
  async buscarPorUsuario(usuarioId) {
    const r = await query(
      `SELECT * FROM tag_subscriptions WHERE usuario_id = $1 LIMIT 1`,
      [usuarioId]
    );
    return r.rows[0] || null;
  },

  async renovarOuCriar(usuarioId, planSlug, transactionNsu) {
    const r = await query(
      `INSERT INTO tag_subscriptions
        (usuario_id, plan_slug, status, valid_until, grace_until, last_transaction_nsu, data_atualizacao)
       VALUES
        (
          $1,
          $2,
          'ativa',
          (NOW() + INTERVAL '30 days'),
          (NOW() + INTERVAL '30 days' + ($4::integer || ' hours')::interval),
          $3,
          NOW()
        )
       ON CONFLICT (usuario_id)
       DO UPDATE SET
         plan_slug = EXCLUDED.plan_slug,
         status = 'ativa',
         valid_until = (CASE
           WHEN tag_subscriptions.valid_until IS NOT NULL AND tag_subscriptions.valid_until > NOW()
             THEN tag_subscriptions.valid_until
           ELSE NOW()
         END) + INTERVAL '30 days',
         grace_until = ((CASE
           WHEN tag_subscriptions.valid_until IS NOT NULL AND tag_subscriptions.valid_until > NOW()
             THEN tag_subscriptions.valid_until
           ELSE NOW()
         END) + INTERVAL '30 days') + ($4::integer || ' hours')::interval,
         last_transaction_nsu = COALESCE($3, tag_subscriptions.last_transaction_nsu),
         data_atualizacao = NOW()
       RETURNING *`,
      [usuarioId, planSlug || 'basico', transactionNsu || null, DEFAULT_GRACE_HOURS]
    );
    return r.rows[0] || null;
  },

  async estaAtivaComGrace(usuarioId) {
    const r = await query(
      `SELECT *,
              (valid_until IS NOT NULL AND valid_until >= NOW()) AS ativo,
              (grace_until IS NOT NULL AND grace_until >= NOW()) AS em_grace
       FROM tag_subscriptions
       WHERE usuario_id = $1
       LIMIT 1`,
      [usuarioId]
    );
    return r.rows[0] || null;
  },
};

module.exports = TagSubscription;
