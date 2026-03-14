const { query } = require('../config/database');

const MAX_POSTS = 10;
const MAX_FIXADAS = 3;

const SELECT_COLS = `
  p.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil,
  pet.nome AS pet_nome, pet.foto AS pet_foto,
  (SELECT COUNT(*)::int FROM curtidas WHERE publicacao_id = p.id) AS total_curtidas,
  (SELECT COUNT(*)::int FROM comentarios WHERE publicacao_id = p.id) AS total_comentarios,
  (SELECT COUNT(*)::int FROM reposts WHERE publicacao_id = p.id) AS total_reposts,
  orig.id AS orig_id, orig.foto AS orig_foto, orig.texto AS orig_texto, orig.legenda AS orig_legenda,
  orig.criado_em AS orig_criado_em, orig.usuario_id AS orig_usuario_id,
  orig_u.nome AS orig_autor_nome, orig_u.cor_perfil AS orig_cor_perfil, orig_u.foto_perfil AS orig_foto_perfil,
  orig_pet.nome AS orig_pet_nome`;

const FROM_JOINS = `
  FROM publicacoes p
  JOIN usuarios u ON u.id = p.usuario_id
  LEFT JOIN pets pet ON pet.id = p.pet_id
  LEFT JOIN publicacoes orig ON orig.id = p.repost_id
  LEFT JOIN usuarios orig_u ON orig_u.id = orig.usuario_id
  LEFT JOIN pets orig_pet ON orig_pet.id = orig.pet_id`;

function curtiuCol(uid) {
  if (!uid) return ', false AS curtiu';
  return `, (SELECT COUNT(*)::int FROM curtidas WHERE publicacao_id = p.id AND usuario_id = ${parseInt(uid)}) > 0 AS curtiu`;
}
function repostouCol(uid) {
  if (!uid) return ', false AS repostou';
  return `, (SELECT COUNT(*)::int FROM reposts WHERE publicacao_id = p.id AND usuario_id = ${parseInt(uid)}) > 0 AS repostou`;
}

const Publicacao = {

  async criar(dados) {
    const { usuario_id, pet_id, foto, legenda, texto, repost_id, tipo } = dados;
    const resultado = await query(
      `INSERT INTO publicacoes (usuario_id, pet_id, foto, legenda, texto, repost_id, tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [usuario_id, pet_id || null, foto || null, legenda || null, texto || null, repost_id || null, tipo || 'original']
    );
    return resultado.rows[0];
  },

  async buscarPorId(id, usuarioAtualId = null) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioAtualId)} ${repostouCol(usuarioAtualId)} ${FROM_JOINS} WHERE p.id = $1`, [id]
    );
    return resultado.rows[0];
  },

  async feedGeral(limite = 20, offset = 0, usuarioAtualId = null) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioAtualId)} ${repostouCol(usuarioAtualId)} ${FROM_JOINS}
       ORDER BY p.fixada DESC, p.criado_em DESC
       LIMIT $1 OFFSET $2`,
      [limite, offset]
    );
    return resultado.rows;
  },

  async feedSeguindo(usuarioId, limite = 20, offset = 0) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioId)} ${repostouCol(usuarioId)} ${FROM_JOINS}
       WHERE p.usuario_id IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $1)
          OR p.usuario_id = $1
       ORDER BY p.fixada DESC, p.criado_em DESC
       LIMIT $2 OFFSET $3`,
      [usuarioId, limite, offset]
    );
    return resultado.rows;
  },

  async feedRegional(usuarioId, limite = 20, offset = 0) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioId)} ${repostouCol(usuarioId)} ${FROM_JOINS}
       JOIN usuarios eu ON eu.id = $1
       WHERE p.usuario_id != $1
         AND u.ultima_localizacao IS NOT NULL
         AND eu.ultima_localizacao IS NOT NULL
         AND ST_DWithin(u.ultima_localizacao, eu.ultima_localizacao, 50000)
       ORDER BY p.criado_em DESC
       LIMIT $2 OFFSET $3`,
      [usuarioId, limite, offset]
    );
    return resultado.rows;
  },

  async feedRegionalCidade(usuarioId, limite = 20, offset = 0) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioId)} ${repostouCol(usuarioId)} ${FROM_JOINS}
       WHERE p.usuario_id != $1
         AND u.cidade IS NOT NULL
         AND LOWER(u.cidade) = LOWER((SELECT cidade FROM usuarios WHERE id = $1))
       ORDER BY
         CASE WHEN LOWER(u.bairro) = LOWER((SELECT bairro FROM usuarios WHERE id = $1)) THEN 0 ELSE 1 END,
         p.criado_em DESC
       LIMIT $2 OFFSET $3`,
      [usuarioId, limite, offset]
    );
    return resultado.rows;
  },

  async buscarPorUsuario(usuarioId, usuarioAtualId = null, limite = 50) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioAtualId)} ${repostouCol(usuarioAtualId)} ${FROM_JOINS}
       WHERE p.usuario_id = $1
       ORDER BY p.fixada DESC, p.criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return resultado.rows;
  },

  async buscarRepostsPorUsuario(usuarioId, usuarioAtualId = null, limite = 50) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioAtualId)}, true AS repostou ${FROM_JOINS}
       WHERE p.id IN (SELECT publicacao_id FROM reposts WHERE usuario_id = $1)
       ORDER BY p.criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return resultado.rows;
  },

  async buscarCurtidasPorUsuario(usuarioId, limite = 50) {
    const resultado = await query(
      `SELECT ${SELECT_COLS}, true AS curtiu ${repostouCol(usuarioId)} ${FROM_JOINS}
       WHERE p.id IN (SELECT publicacao_id FROM curtidas WHERE usuario_id = $1)
       ORDER BY (SELECT criado_em FROM curtidas WHERE publicacao_id = p.id AND usuario_id = $1) DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return resultado.rows;
  },

  async fixar(id) {
    const resultado = await query(
      `UPDATE publicacoes SET fixada = true WHERE id = $1 RETURNING *`, [id]
    );
    return resultado.rows[0];
  },

  async desafixar(id) {
    const resultado = await query(
      `UPDATE publicacoes SET fixada = false WHERE id = $1 RETURNING *`, [id]
    );
    return resultado.rows[0];
  },

  async contarFixadas(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM publicacoes WHERE usuario_id = $1 AND fixada = true`, [usuarioId]
    );
    return resultado.rows[0].total;
  },

  async contarAtivas(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM publicacoes WHERE usuario_id = $1 AND tipo = 'original'`, [usuarioId]
    );
    return resultado.rows[0].total;
  },

  async buscarMaisAntigaNaoFixada(usuarioId) {
    const resultado = await query(
      `SELECT * FROM publicacoes
       WHERE usuario_id = $1 AND fixada = false AND tipo = 'original'
       ORDER BY criado_em ASC LIMIT 1`,
      [usuarioId]
    );
    return resultado.rows[0];
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM publicacoes WHERE id = $1 RETURNING *`, [id]
    );
    return resultado.rows[0];
  },

  MAX_POSTS,
  MAX_FIXADAS,
};

module.exports = Publicacao;
