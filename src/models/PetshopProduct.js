const { query } = require('../config/database');

const PetshopProduct = {
  async criar(dados) {
    const result = await query(
      `INSERT INTO petshop_products (
        petshop_id, post_id, service_id, nome, preco, descricao, foto_url, contato_link, is_promocao, is_active,
        is_highlighted, highlight_rank
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
      RETURNING *`,
      [
        dados.petshop_id,
        dados.post_id || null,
        dados.service_id || null,
        dados.nome,
        dados.preco || 0,
        dados.descricao || null,
        dados.foto_url || null,
        dados.contato_link || null,
        !!dados.is_promocao,
        !!dados.is_highlighted,
        dados.highlight_rank != null ? Number(dados.highlight_rank) : 0,
      ]
    );
    return result.rows[0];
  },

  async listarAtivosPorPetshop(petshopId) {
    const result = await query(
      `SELECT *
       FROM petshop_products
       WHERE petshop_id = $1 AND is_active = true
       ORDER BY data_criacao DESC`,
      [petshopId]
    );
    return result.rows;
  },

  async contarAtivosPorPetshop(petshopId) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_products
       WHERE petshop_id = $1 AND is_active = true`,
      [petshopId]
    );
    return result.rows[0].total;
  },

  async listarPromocoesProximas({ usuarioId, lat, lng, limite = 8 }) {
    const limitSeguro = Number.isInteger(limite) && limite > 0 ? limite : 8;
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const params = [usuarioId, limitSeguro];
    let geoCols = `NULL::numeric AS distancia_metros`;
    let geoOrder = `p.avaliacao_media DESC, p.avaliacoes_count DESC`;

    if (hasGeo) {
      params.push(lat, lng);
      geoCols = `ST_Distance(
          p.localizacao,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
        ) AS distancia_metros`;
      geoOrder = `distancia_metros ASC, p.avaliacao_media DESC, p.avaliacoes_count DESC`;
    }

    const result = await query(
      `SELECT
         pr.id,
         pr.nome AS titulo,
         COALESCE(pr.descricao, '') AS descricao_curta,
         pr.preco,
         pr.foto_url,
         pr.contato_link,
         pr.data_criacao AS validade,
        pr.is_highlighted,
        pr.highlight_rank,
         p.id AS petshop_id,
         p.nome AS petshop_nome,
         p.slug AS petshop_slug,
         p.logo_url AS petshop_logo_url,
         p.avaliacao_media,
         p.avaliacoes_count,
         ${geoCols},
         EXISTS (
           SELECT 1 FROM petshop_followers pf
           WHERE pf.petshop_id = p.id AND pf.usuario_id = $1
         ) AS usuario_segue,
         EXISTS (
           SELECT 1
           FROM pet_petshop_links ppl
           JOIN pets my_pet ON my_pet.id = ppl.pet_id
           WHERE ppl.petshop_id = p.id
             AND ppl.ativo = true
             AND my_pet.usuario_id = $1
         ) AS usuario_vinculado,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM pet_petshop_links ppl
             JOIN pets my_pet ON my_pet.id = ppl.pet_id
             WHERE ppl.petshop_id = p.id
               AND ppl.ativo = true
               AND my_pet.usuario_id = $1
           ) THEN 'vinculado'
           WHEN EXISTS (
             SELECT 1 FROM petshop_followers pf
             WHERE pf.petshop_id = p.id AND pf.usuario_id = $1
           ) THEN 'seguindo'
           ELSE 'descoberta'
         END AS relationship_level
       FROM petshop_products pr
       JOIN petshops p ON p.id = pr.petshop_id
       WHERE pr.is_active = true
         AND pr.is_promocao = true
         AND p.ativo = true
       ORDER BY ${geoOrder}
       LIMIT $2`,
      params
    );
    return result.rows;
  },

  async listarPromocoesElegiveisFeed(usuarioId, limite = 2) {
    const limitSeguro = Number.isInteger(limite) && limite > 0 ? limite : 2;
    const result = await query(
      `SELECT
         pr.id,
         pr.nome AS titulo,
         COALESCE(pr.descricao, '') AS descricao_curta,
         pr.preco,
         pr.foto_url,
         pr.contato_link,
         pr.data_criacao AS validade,
         p.id AS petshop_id,
         p.nome AS petshop_nome,
         p.slug AS petshop_slug,
         p.logo_url AS petshop_logo_url,
         p.avaliacao_media,
         p.avaliacoes_count,
         EXISTS (
           SELECT 1 FROM petshop_followers pf
           WHERE pf.petshop_id = p.id AND pf.usuario_id = $1
         ) AS usuario_segue,
         EXISTS (
           SELECT 1
           FROM pet_petshop_links ppl
           JOIN pets my_pet ON my_pet.id = ppl.pet_id
           WHERE ppl.petshop_id = p.id
             AND ppl.ativo = true
             AND my_pet.usuario_id = $1
         ) AS usuario_vinculado,
         COALESCE((
           SELECT MAX(COALESCE(ppl.relevance_score, 0))
           FROM pet_petshop_links ppl
           JOIN pets my_pet ON my_pet.id = ppl.pet_id
           WHERE ppl.petshop_id = p.id
             AND ppl.ativo = true
             AND my_pet.usuario_id = $1
         ), 0) AS relevance_score,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM pet_petshop_links ppl
             JOIN pets my_pet ON my_pet.id = ppl.pet_id
             WHERE ppl.petshop_id = p.id
               AND ppl.ativo = true
               AND my_pet.usuario_id = $1
           ) THEN 'vinculado'
           WHEN EXISTS (
             SELECT 1 FROM petshop_followers pf
             WHERE pf.petshop_id = p.id AND pf.usuario_id = $1
           ) THEN 'seguindo'
           ELSE 'descoberta'
         END AS relationship_level
       FROM petshop_products pr
       JOIN petshops p ON p.id = pr.petshop_id
       WHERE pr.is_active = true
         AND pr.is_promocao = true
         AND p.ativo = true
         AND (
           EXISTS (SELECT 1 FROM petshop_followers pf WHERE pf.petshop_id = p.id AND pf.usuario_id = $1)
           OR EXISTS (
             SELECT 1
             FROM pet_petshop_links ppl
             JOIN pets my_pet ON my_pet.id = ppl.pet_id
             WHERE ppl.petshop_id = p.id
               AND ppl.ativo = true
               AND my_pet.usuario_id = $1
           )
         )
       ORDER BY usuario_vinculado DESC, relevance_score DESC, pr.data_criacao DESC
       LIMIT $2`,
      [usuarioId, limitSeguro]
    );
    return result.rows;
  },
};

module.exports = PetshopProduct;
