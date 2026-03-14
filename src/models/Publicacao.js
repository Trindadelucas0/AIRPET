const { query } = require('../config/database');

const Publicacao = {

  async criar(dados) {
    const { usuario_id, pet_id, foto, legenda } = dados;
    const resultado = await query(
      `INSERT INTO publicacoes (usuario_id, pet_id, foto, legenda)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [usuario_id, pet_id || null, foto, legenda || null]
    );
    return resultado.rows[0];
  },

  async buscarPorId(id) {
    const resultado = await query(
      `SELECT p.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil,
              pet.nome AS pet_nome, pet.foto AS pet_foto,
              (SELECT COUNT(*) FROM curtidas WHERE publicacao_id = p.id) AS total_curtidas,
              (SELECT COUNT(*) FROM comentarios WHERE publicacao_id = p.id) AS total_comentarios
       FROM publicacoes p
       JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN pets pet ON pet.id = p.pet_id
       WHERE p.id = $1`,
      [id]
    );
    return resultado.rows[0];
  },

  async feedGeral(limite = 20, offset = 0, usuarioAtualId = null) {
    const resultado = await query(
      `SELECT p.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil,
              pet.nome AS pet_nome,
              (SELECT COUNT(*) FROM curtidas WHERE publicacao_id = p.id) AS total_curtidas,
              (SELECT COUNT(*) FROM comentarios WHERE publicacao_id = p.id) AS total_comentarios,
              ${usuarioAtualId ? `(SELECT COUNT(*) FROM curtidas WHERE publicacao_id = p.id AND usuario_id = ${parseInt(usuarioAtualId)}) > 0 AS curtiu` : 'false AS curtiu'}
       FROM publicacoes p
       JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN pets pet ON pet.id = p.pet_id
       WHERE p.fixada = true OR p.criado_em > NOW() - INTERVAL '3 days'
       ORDER BY p.fixada DESC, p.criado_em DESC
       LIMIT $1 OFFSET $2`,
      [limite, offset]
    );
    return resultado.rows;
  },

  async feedSeguindo(usuarioId, limite = 20, offset = 0) {
    const resultado = await query(
      `SELECT p.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil,
              pet.nome AS pet_nome,
              (SELECT COUNT(*) FROM curtidas WHERE publicacao_id = p.id) AS total_curtidas,
              (SELECT COUNT(*) FROM comentarios WHERE publicacao_id = p.id) AS total_comentarios,
              (SELECT COUNT(*) FROM curtidas WHERE publicacao_id = p.id AND usuario_id = $1) > 0 AS curtiu
       FROM publicacoes p
       JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN pets pet ON pet.id = p.pet_id
       WHERE p.usuario_id IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $1)
         AND (p.fixada = true OR p.criado_em > NOW() - INTERVAL '3 days')
       ORDER BY p.criado_em DESC
       LIMIT $2 OFFSET $3`,
      [usuarioId, limite, offset]
    );
    return resultado.rows;
  },

  async buscarPorUsuario(usuarioId, usuarioAtualId = null, limite = 50) {
    const resultado = await query(
      `SELECT p.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil,
              pet.nome AS pet_nome,
              (SELECT COUNT(*) FROM curtidas WHERE publicacao_id = p.id) AS total_curtidas,
              (SELECT COUNT(*) FROM comentarios WHERE publicacao_id = p.id) AS total_comentarios,
              ${usuarioAtualId ? `(SELECT COUNT(*) FROM curtidas WHERE publicacao_id = p.id AND usuario_id = ${parseInt(usuarioAtualId)}) > 0 AS curtiu` : 'false AS curtiu'}
       FROM publicacoes p
       JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN pets pet ON pet.id = p.pet_id
       WHERE p.usuario_id = $1
         AND (p.fixada = true OR p.criado_em > NOW() - INTERVAL '3 days')
       ORDER BY p.fixada DESC, p.criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return resultado.rows;
  },

  async fixar(id) {
    const resultado = await query(
      `UPDATE publicacoes SET fixada = true WHERE id = $1 RETURNING *`,
      [id]
    );
    return resultado.rows[0];
  },

  async desafixar(id) {
    const resultado = await query(
      `UPDATE publicacoes SET fixada = false WHERE id = $1 RETURNING *`,
      [id]
    );
    return resultado.rows[0];
  },

  async contarFixadas(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM publicacoes WHERE usuario_id = $1 AND fixada = true`,
      [usuarioId]
    );
    return parseInt(resultado.rows[0].total);
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM publicacoes WHERE id = $1 RETURNING *`,
      [id]
    );
    return resultado.rows[0];
  },

  async limparExpirados() {
    const resultado = await query(
      `DELETE FROM publicacoes
       WHERE fixada = false AND criado_em < NOW() - INTERVAL '3 days'
       RETURNING foto`
    );
    return resultado.rows;
  },
};

module.exports = Publicacao;
