const { query } = require('../config/database');

const PostMedia = {
  async criar(postId, mediaUrl, mediaType = 'image', orderIndex = 0, status = 'ready') {
    const r = await query(
      `INSERT INTO post_media (post_id, media_url, media_type, order_index, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [postId, mediaUrl, mediaType, orderIndex, status]
    );
    return r.rows[0];
  },

  async listarPorPost(postId) {
    const r = await query(
      `SELECT * FROM post_media WHERE post_id = $1 ORDER BY order_index ASC, id ASC`,
      [postId]
    );
    return r.rows;
  },
};

module.exports = PostMedia;
