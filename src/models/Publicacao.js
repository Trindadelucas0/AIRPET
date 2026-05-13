const { query } = require('../config/database');

const MAX_POSTS = 10;
const MAX_FIXADAS = 3;

const SELECT_COLS = `
  p.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil,
  pet.nome AS pet_nome, pet.foto AS pet_foto,
  COALESCE(ps.like_count, 0) AS total_curtidas,
  COALESCE(ps.comment_count, 0) AS total_comentarios,
  COALESCE(ps.repost_count, 0) AS total_reposts,
  orig.id AS orig_id, orig.foto AS orig_foto, orig.texto AS orig_texto, orig.legenda AS orig_legenda,
  orig.criado_em AS orig_criado_em, orig.usuario_id AS orig_usuario_id,
  orig_u.nome AS orig_autor_nome, orig_u.cor_perfil AS orig_cor_perfil, orig_u.foto_perfil AS orig_foto_perfil,
  orig.pet_id AS orig_pet_id, orig_pet.nome AS orig_pet_nome, orig_pet.foto AS orig_pet_foto`;

const FROM_JOINS = `
  FROM publicacoes p
  JOIN usuarios u ON u.id = p.usuario_id
  LEFT JOIN pets pet ON pet.id = p.pet_id
  LEFT JOIN post_stats ps ON ps.post_id = p.id
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

    /*
     * Regra de produto AIRPET: toda foto/post pertence a UM pet especifico.
     * Pet_id e obrigatorio em posts originais (com foto).
     *
     * Exceptions:
     *   - reposts (repost_id presente) podem nao ter pet_id (estao replicando
     *     conteudo de outro autor; o pet original esta no post raiz).
     */
    const ehRepost = !!repost_id;
    if (!ehRepost && (pet_id == null || pet_id === '')) {
      const err = new Error('PET_ID_OBRIGATORIO');
      err.code = 'PET_ID_OBRIGATORIO';
      throw err;
    }

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

  async feedPorCursor(usuarioId, limite = 20, beforeId = null) {
    const hasCursor = Number.isInteger(beforeId) && beforeId > 0;
    const params = [usuarioId, limite];
    let cursorFilter = '';
    if (hasCursor) {
      params.push(beforeId);
      cursorFilter = ' AND p.id < $3 ';
    }
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioId)} ${repostouCol(usuarioId)}
       ${FROM_JOINS}
       WHERE (
         p.usuario_id IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $1)
         OR p.usuario_id = $1
       )
       ${cursorFilter}
       ORDER BY p.id DESC
       LIMIT $2`,
      params
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

  async feedSeguindoPets(usuarioId, limite = 20, offset = 0) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioId)} ${repostouCol(usuarioId)},
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM pet_petshop_links ppl
             JOIN pets my_pet ON my_pet.id = ppl.pet_id
             WHERE ppl.ativo = true
               AND p.pet_id IS NOT NULL
               AND p.pet_id IN (
                 SELECT pet_id FROM pet_petshop_links l2
                 WHERE l2.petshop_id = ppl.petshop_id
                   AND l2.ativo = true
               )
               AND my_pet.usuario_id = $1
           ) THEN 3
           WHEN p.pet_id IS NOT NULL AND p.pet_id IN (SELECT pet_id FROM seguidores_pets WHERE usuario_id = $1) THEN 2
           WHEN EXISTS (
             SELECT 1
             FROM petshop_followers pf
             JOIN pet_petshop_links l3 ON l3.petshop_id = pf.petshop_id AND l3.ativo = true
             WHERE pf.usuario_id = $1
               AND l3.pet_id = p.pet_id
           ) THEN 1
           ELSE 0
         END AS prioridade_relacao
       ${FROM_JOINS}
       WHERE (
         p.pet_id IS NOT NULL
         AND (
           p.pet_id IN (SELECT pet_id FROM seguidores_pets WHERE usuario_id = $1)
           OR EXISTS (
             SELECT 1
             FROM petshop_followers pf
             JOIN pet_petshop_links l3 ON l3.petshop_id = pf.petshop_id AND l3.ativo = true
             WHERE pf.usuario_id = $1
               AND l3.pet_id = p.pet_id
           )
           OR EXISTS (
             SELECT 1
             FROM pet_petshop_links lnk
             JOIN pet_petshop_links my_link ON my_link.petshop_id = lnk.petshop_id AND my_link.ativo = true
             JOIN pets my_pet ON my_pet.id = my_link.pet_id
             WHERE lnk.ativo = true
               AND lnk.pet_id = p.pet_id
               AND my_pet.usuario_id = $1
           )
         )
       )
       OR p.usuario_id = $1
       ORDER BY p.fixada DESC, prioridade_relacao DESC, p.criado_em DESC, p.id DESC
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

  /** Mesmo recorte geográfico que feedRegional, ordenado por engajamento (descoberta no Explorar). */
  async feedRegionalPorEngajamento(usuarioId, limite = 20, offset = 0) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioId)} ${repostouCol(usuarioId)} ${FROM_JOINS}
       JOIN usuarios eu ON eu.id = $1
       WHERE p.usuario_id != $1
         AND u.ultima_localizacao IS NOT NULL
         AND eu.ultima_localizacao IS NOT NULL
         AND ST_DWithin(u.ultima_localizacao, eu.ultima_localizacao, 50000)
       ORDER BY
         (COALESCE(ps.like_count, 0) + COALESCE(ps.comment_count, 0) * 2 + COALESCE(ps.repost_count, 0)) DESC,
         p.criado_em DESC,
         p.id DESC
       LIMIT $2 OFFSET $3`,
      [usuarioId, limite, offset]
    );
    return resultado.rows;
  },

  async feedGeralPorEngajamento(limite = 20, offset = 0, usuarioAtualId = null) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioAtualId)} ${repostouCol(usuarioAtualId)} ${FROM_JOINS}
       ORDER BY
         (COALESCE(ps.like_count, 0) + COALESCE(ps.comment_count, 0) * 2 + COALESCE(ps.repost_count, 0)) DESC,
         p.criado_em DESC,
         p.id DESC
       LIMIT $1 OFFSET $2`,
      [limite, offset]
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

  async buscarPorPet(petId, usuarioAtualId = null, limite = 50) {
    const resultado = await query(
      `SELECT ${SELECT_COLS} ${curtiuCol(usuarioAtualId)} ${repostouCol(usuarioAtualId)} ${FROM_JOINS}
       WHERE p.pet_id = $1
       ORDER BY p.fixada DESC, p.criado_em DESC
       LIMIT $2`,
      [petId, limite]
    );
    return resultado.rows;
  },

  async buscarPatrocinadosPetAtivos(usuarioId = null, limite = 6) {
    const limiteSeguro = Number.isInteger(limite) && limite > 0 ? limite : 6;
    const resultado = await query(
      `SELECT
         mb.id AS boost_id,
         mb.target_id AS pet_id,
         mb.boost_value,
         mb.reason,
         mb.starts_at,
         mb.ends_at,
         pet.nome AS pet_nome,
         pet.foto AS pet_foto,
         dono.id AS usuario_id,
         dono.nome AS autor_nome,
         dono.cor_perfil,
         dono.foto_perfil,
         p.id,
         p.foto,
         p.legenda,
         p.texto,
         p.criado_em,
         TRUE AS is_sponsored,
         'PATROCINADO'::text AS sponsored_label,
         'pet_profile'::text AS sponsor_type
       FROM manual_boosts mb
       JOIN pets pet ON pet.id = mb.target_id
       JOIN usuarios dono ON dono.id = pet.usuario_id
       LEFT JOIN LATERAL (
         SELECT pub.id, pub.foto, pub.legenda, pub.texto, pub.criado_em
         FROM publicacoes pub
         WHERE pub.pet_id = pet.id
         ORDER BY pub.criado_em DESC
         LIMIT 1
       ) p ON TRUE
       WHERE mb.target_type = 'pet'
         AND mb.starts_at <= NOW()
         AND (mb.ends_at IS NULL OR mb.ends_at >= NOW())
       ORDER BY mb.boost_value DESC, mb.created_at DESC
       LIMIT $1`,
      [limiteSeguro]
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

  async buscarRecenteIgual(usuarioId, texto, petId = null, secondsWindow = 15) {
    const r = await query(
      `SELECT id, criado_em
         FROM publicacoes
        WHERE usuario_id = $1
          AND tipo = 'original'
          AND COALESCE(texto, '') = COALESCE($2, '')
          AND COALESCE(pet_id, 0) = COALESCE($3, 0)
          AND criado_em >= NOW() - ($4 || ' seconds')::interval
        ORDER BY id DESC
        LIMIT 1`,
      [usuarioId, texto || '', petId || null, String(secondsWindow)]
    );
    return r.rows[0] || null;
  },

  async ultimoPostDoUsuario(usuarioId) {
    const r = await query(
      `SELECT id, criado_em
         FROM publicacoes
        WHERE usuario_id = $1
          AND tipo = 'original'
        ORDER BY id DESC
        LIMIT 1`,
      [usuarioId]
    );
    return r.rows[0] || null;
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
