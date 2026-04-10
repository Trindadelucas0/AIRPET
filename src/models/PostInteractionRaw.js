const { query } = require('../config/database');

const PostInteractionRaw = {
  async registrarVisualizacaoUnica({ userId, postId, watchMs, city, metadata }) {
    const existente = await query(
      `SELECT id
         FROM post_interactions_raw
        WHERE user_id = $1
          AND post_id = $2
          AND event_type = 'view'
        LIMIT 1`,
      [userId, postId]
    );
    if (existente.rows.length > 0) {
      return { inserido: false };
    }

    await query(
      `INSERT INTO post_interactions_raw
         (user_id, post_id, event_type, watch_ms, city, metadata)
       VALUES
         ($1, $2, 'view', $3, $4, $5::jsonb)`,
      [userId, postId, watchMs, city || null, JSON.stringify(metadata || {})]
    );
    return { inserido: true };
  },
};

module.exports = PostInteractionRaw;
