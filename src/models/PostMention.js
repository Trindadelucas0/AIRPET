const { query } = require('../config/database');

const PostMention = {
  extrairMencoes(texto) {
    if (!texto) return [];
    const regex = /@([A-Za-z0-9_][A-Za-z0-9_\s]{0,49})/g;
    const nomes = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
      const nome = String(match[1] || '').trim();
      if (nome) nomes.push(nome);
    }
    return [...new Set(nomes)];
  },

  async resolverUsuariosPorNome(nomes) {
    if (!Array.isArray(nomes) || !nomes.length) return [];
    const placeholders = nomes.map((_, i) => `$${i + 1}`).join(', ');
    const values = nomes.map((n) => n.toLowerCase());
    const r = await query(
      `SELECT id, nome FROM usuarios WHERE LOWER(nome) IN (${placeholders})`,
      values
    );
    return r.rows;
  },

  async criarEmLote(postId, authorUserId, userIds) {
    if (!postId || !Array.isArray(userIds) || !userIds.length) return;
    const insertSql = `
      INSERT INTO post_mentions (post_id, mentioned_user_id, author_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (post_id, mentioned_user_id) DO NOTHING
    `;
    for (const uid of userIds) {
      if (!uid || uid === authorUserId) continue;
      await query(insertSql, [postId, uid, authorUserId]);
    }
  },
};

module.exports = PostMention;
