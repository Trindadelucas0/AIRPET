const { query } = require('../config/database');

const recomendacaoService = {

  /**
   * Recomenda usuarios proximos com base na localizacao geografica.
   * Usa PostGIS ST_DWithin para calcular distancia em metros.
   * Exclui o proprio usuario e quem ja segue.
   */
  async usuariosProximos(usuarioId, limiteKm = 50, max = 10) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, u.bio, u.cidade, u.bairro,
              ROUND(ST_Distance(u.ultima_localizacao, eu.ultima_localizacao)::numeric / 1000, 1) AS distancia_km,
              (SELECT COUNT(*)::int FROM publicacoes WHERE usuario_id = u.id) AS total_posts,
              (SELECT COUNT(*)::int FROM seguidores WHERE seguido_id = u.id) AS total_seguidores
       FROM usuarios u
       CROSS JOIN usuarios eu
       WHERE eu.id = $1
         AND u.id != $1
         AND u.ultima_localizacao IS NOT NULL
         AND eu.ultima_localizacao IS NOT NULL
         AND ST_DWithin(u.ultima_localizacao, eu.ultima_localizacao, $2)
         AND u.id NOT IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $1)
       ORDER BY ST_Distance(u.ultima_localizacao, eu.ultima_localizacao) ASC
       LIMIT $3`,
      [usuarioId, limiteKm * 1000, max]
    );
    return resultado.rows;
  },

  /**
   * Recomenda usuarios da mesma cidade/bairro (fallback se nao tem lat/lng).
   */
  async usuariosMesmaCidade(usuarioId, max = 10) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, u.bio, u.cidade, u.bairro,
              (SELECT COUNT(*)::int FROM publicacoes WHERE usuario_id = u.id) AS total_posts,
              (SELECT COUNT(*)::int FROM seguidores WHERE seguido_id = u.id) AS total_seguidores
       FROM usuarios u
       WHERE u.id != $1
         AND u.cidade IS NOT NULL
         AND LOWER(u.cidade) = LOWER((SELECT cidade FROM usuarios WHERE id = $1))
         AND u.id NOT IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $1)
       ORDER BY
         CASE WHEN LOWER(u.bairro) = LOWER((SELECT bairro FROM usuarios WHERE id = $1)) THEN 0 ELSE 1 END,
         (SELECT COUNT(*) FROM seguidores WHERE seguido_id = u.id) DESC
       LIMIT $2`,
      [usuarioId, max]
    );
    return resultado.rows;
  },

  /**
   * Recomenda pessoas para seguir (combina proximidade + cidade).
   * Tenta primeiro por geolocation, fallback para cidade.
   */
  async recomendarPessoas(usuarioId, max = 10) {
    let recomendados = await this.usuariosProximos(usuarioId, 50, max);
    if (recomendados.length < max) {
      const porCidade = await this.usuariosMesmaCidade(usuarioId, max - recomendados.length);
      const idsJaTem = new Set(recomendados.map(r => r.id));
      for (const u of porCidade) {
        if (!idsJaTem.has(u.id)) recomendados.push(u);
      }
    }
    return recomendados.slice(0, max);
  },

  /**
   * Busca pets por nome (para painel de busca).
   */
  async buscarPets(termo, usuarioId = null, limite = 20) {
    let sql = `
      SELECT p.id, p.nome, p.foto, p.tipo, p.raca,
             u.id AS dono_id, u.nome AS dono_nome, u.cor_perfil AS dono_cor_perfil, u.foto_perfil AS dono_foto_perfil,
             (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id) AS total_seguidores`;
    if (usuarioId) {
      sql += `, (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id AND usuario_id = ${parseInt(usuarioId)}) > 0 AS seguindo`;
    } else {
      sql += `, false AS seguindo`;
    }
    sql += `
      FROM pets p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE LOWER(p.nome) LIKE $1
      ORDER BY (SELECT COUNT(*) FROM seguidores_pets WHERE pet_id = p.id) DESC, p.nome ASC
      LIMIT $2`;
    const resultado = await query(sql, ['%' + termo.toLowerCase() + '%', limite]);
    return resultado.rows;
  },

  /**
   * Pets populares / proximos para recomendar.
   */
  async petsRecomendados(usuarioId, max = 8) {
    const resultado = await query(
      `SELECT p.id, p.nome, p.foto, p.tipo, p.raca,
              u.id AS dono_id, u.nome AS dono_nome, u.cor_perfil AS dono_cor_perfil,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id) AS total_seguidores,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id AND usuario_id = $1) > 0 AS seguindo
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.usuario_id != $1
         AND p.id NOT IN (SELECT pet_id FROM seguidores_pets WHERE usuario_id = $1)
       ORDER BY (SELECT COUNT(*) FROM seguidores_pets WHERE pet_id = p.id) DESC, p.data_criacao DESC
       LIMIT $2`,
      [usuarioId, max]
    );
    return resultado.rows;
  },

  /**
   * Pets cujos donos estao na mesma regiao que o usuario de referencia (ex.: autor do post).
   * Usado na secao "Pets proximos" ao abrir uma publicacao no Explorar.
   */
  async petsProximos(usuarioIdReferencia, usuarioIdLogado, limite = 8) {
    const resultado = await query(
      `SELECT p.id, p.nome, p.foto, p.tipo, p.raca,
              u.id AS dono_id, u.nome AS dono_nome, u.cor_perfil AS dono_cor_perfil,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id) AS total_seguidores,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id AND usuario_id = $2) > 0 AS seguindo
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       CROSS JOIN usuarios ref ON ref.id = $1
       WHERE ref.ultima_localizacao IS NOT NULL
         AND u.ultima_localizacao IS NOT NULL
         AND u.id != $1
         AND u.id != $2
         AND ST_DWithin(u.ultima_localizacao, ref.ultima_localizacao, 50000)
         AND p.id NOT IN (SELECT pet_id FROM seguidores_pets WHERE usuario_id = $2)
       ORDER BY ST_Distance(u.ultima_localizacao, ref.ultima_localizacao) ASC
       LIMIT $3`,
      [usuarioIdReferencia, usuarioIdLogado, limite]
    );
    return resultado.rows;
  },
};

module.exports = recomendacaoService;
