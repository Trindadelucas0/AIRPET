const { query } = require('../config/database');

const ACTIVE_LIMIT = 5;

const PostTag = {
  async contarAtivosAprovados(taggedUserId) {
    const r = await query(
      `SELECT COUNT(*)::int AS total
         FROM post_tags
        WHERE tagged_user_id = $1
          AND status = 'approved'`,
      [taggedUserId]
    );
    return r.rows[0]?.total || 0;
  },

  async criarPendentes(postId, taggedByUserId, taggedUserIds = []) {
    const limpos = [...new Set((taggedUserIds || []).map((v) => parseInt(v, 10)).filter(Boolean))]
      .filter((uid) => uid !== taggedByUserId)
      .slice(0, 10);
    const criados = [];
    for (const taggedUserId of limpos) {
      const r = await query(
        `INSERT INTO post_tags (post_id, tagged_user_id, tagged_by_user_id, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (post_id, tagged_user_id) DO NOTHING
         RETURNING *`,
        [postId, taggedUserId, taggedByUserId]
      );
      if (r.rows[0]) criados.push(r.rows[0]);
    }
    return criados;
  },

  async responder(tagId, taggedUserId, action) {
    if (!['approve', 'reject'].includes(action)) return null;
    const status = action === 'approve' ? 'approved' : 'rejected';
    if (status === 'approved') {
      const totalAtivos = await this.contarAtivosAprovados(taggedUserId);
      if (totalAtivos >= ACTIVE_LIMIT) {
        const err = new Error(`Limite de ${ACTIVE_LIMIT} marcações ativas atingido.`);
        err.code = 'TAG_LIMIT';
        throw err;
      }
    }
    const r = await query(
      `UPDATE post_tags
          SET status = $1, responded_at = NOW()
        WHERE id = $2 AND tagged_user_id = $3 AND status = 'pending'
      RETURNING *`,
      [status, tagId, taggedUserId]
    );
    return r.rows[0] || null;
  },

  async listarPendentes(taggedUserId, limit = 20) {
    const r = await query(
      `SELECT pt.*, p.texto, p.legenda, p.foto, p.criado_em, u.nome AS tagged_by_nome
         FROM post_tags pt
         JOIN publicacoes p ON p.id = pt.post_id
         JOIN usuarios u ON u.id = pt.tagged_by_user_id
        WHERE pt.tagged_user_id = $1
          AND pt.status = 'pending'
        ORDER BY pt.created_at DESC
        LIMIT $2`,
      [taggedUserId, limit]
    );
    return r.rows;
  },

  async listarAprovados(taggedUserId, limit = 20) {
    const r = await query(
      `SELECT pt.*, p.texto, p.legenda, p.foto, p.criado_em
         FROM post_tags pt
         JOIN publicacoes p ON p.id = pt.post_id
        WHERE pt.tagged_user_id = $1
          AND pt.status = 'approved'
        ORDER BY pt.responded_at DESC NULLS LAST, pt.created_at DESC
        LIMIT $2`,
      [taggedUserId, limit]
    );
    return r.rows;
  },

  ACTIVE_LIMIT,
};

module.exports = PostTag;
