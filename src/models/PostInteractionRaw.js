const { query } = require('../config/database');

const PostInteractionRaw = {
  async registrarVisualizacao({ userId, postId, watchMs, city, metadata }) {
    await query(
      `INSERT INTO post_interactions_raw
         (user_id, post_id, event_type, watch_ms, city, metadata)
       VALUES
         ($1, $2, 'view', $3, $4, $5::jsonb)`,
      [userId, postId, watchMs, city || null, JSON.stringify(metadata || {})]
    );
  },
};

module.exports = PostInteractionRaw;
