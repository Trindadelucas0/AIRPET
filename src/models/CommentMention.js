const { query } = require('../config/database');

const CommentMention = {
  async criarEmLote(commentId, authorUserId, userIds) {
    if (!commentId || !Array.isArray(userIds) || !userIds.length) return;
    const insertSql = `
      INSERT INTO comment_mentions (comment_id, mentioned_user_id, author_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING
    `;
    for (const uid of userIds) {
      if (!uid || uid === authorUserId) continue;
      await query(insertSql, [commentId, uid, authorUserId]);
    }
  },
};

module.exports = CommentMention;
