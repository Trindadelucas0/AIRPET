const { query, getClient } = require('../config/database');

const PetPetshopLink = {
  async vincular({ pet_id, petshop_id, tipo_vinculo = 'cliente', principal = false, relevance_score = null }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      if (principal) {
        await client.query(
          `UPDATE pet_petshop_links
           SET is_principal = false, data_atualizacao = NOW()
           WHERE pet_id = $1`,
          [pet_id]
        );
      }

      const result = await client.query(
        `INSERT INTO pet_petshop_links (pet_id, petshop_id, tipo_vinculo, ativo, is_principal, relevance_score)
         VALUES ($1, $2, $3, true, $4, COALESCE($5, 0))
         ON CONFLICT (pet_id, petshop_id) DO UPDATE SET
           tipo_vinculo = EXCLUDED.tipo_vinculo,
           ativo = true,
           is_principal = EXCLUDED.is_principal,
           relevance_score = COALESCE(EXCLUDED.relevance_score, pet_petshop_links.relevance_score),
           data_atualizacao = NOW()
         RETURNING *`,
        [pet_id, petshop_id, tipo_vinculo, !!principal, relevance_score]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async listarPetsDoPetshop(petshopId) {
    const result = await query(
      `SELECT l.*, p.nome AS pet_nome, p.foto AS pet_foto, p.usuario_id
       FROM pet_petshop_links l
       JOIN pets p ON p.id = l.pet_id
       WHERE l.petshop_id = $1 AND l.ativo = true`,
      [petshopId]
    );
    return result.rows;
  },

  async listarPetsDetalhadosPorPetshop(petshopId) {
    const result = await query(
      `SELECT l.id AS link_id, l.pet_id, l.petshop_id, l.tipo_vinculo, l.is_principal, l.relevance_score,
              p.nome AS pet_nome, p.foto AS pet_foto, p.tipo AS pet_tipo, p.raca AS pet_raca, p.porte AS pet_porte,
              p.sexo AS pet_sexo, p.peso AS pet_peso, p.data_nascimento, p.descricao_emocional,
              p.alergias_medicacoes, p.veterinario_nome, p.veterinario_telefone, p.observacoes,
              u.id AS tutor_id, u.nome AS tutor_nome, u.email AS tutor_email, u.telefone AS tutor_telefone, u.contato_extra AS tutor_whatsapp
       FROM pet_petshop_links l
       JOIN pets p ON p.id = l.pet_id
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE l.petshop_id = $1
         AND l.ativo = true
       ORDER BY l.is_principal DESC, l.relevance_score DESC, p.nome ASC`,
      [petshopId]
    );
    return result.rows;
  },

  async listarPorPet(petId) {
    const result = await query(
      `SELECT l.*, p.id AS petshop_id, p.nome AS petshop_nome, p.slug AS petshop_slug, p.logo_url, p.ativo
       FROM pet_petshop_links l
       JOIN petshops p ON p.id = l.petshop_id
       WHERE l.pet_id = $1 AND l.ativo = true
       ORDER BY l.is_principal DESC, l.relevance_score DESC, l.data_criacao DESC`,
      [petId]
    );
    return result.rows;
  },

  async atualizarPrincipal(petId, petshopId) {
    await query(
      `UPDATE pet_petshop_links
       SET is_principal = false, data_atualizacao = NOW()
       WHERE pet_id = $1`,
      [petId]
    );
    const result = await query(
      `UPDATE pet_petshop_links
       SET is_principal = true, ativo = true, relevance_score = GREATEST(COALESCE(relevance_score, 0), 100), data_atualizacao = NOW()
       WHERE pet_id = $1 AND petshop_id = $2
       RETURNING *`,
      [petId, petshopId]
    );
    return result.rows[0] || null;
  },

  async desvincular(petId, petshopId) {
    const result = await query(
      `UPDATE pet_petshop_links
       SET ativo = false, data_atualizacao = NOW()
       WHERE pet_id = $1 AND petshop_id = $2
       RETURNING *`,
      [petId, petshopId]
    );
    return result.rows[0] || null;
  },
};

module.exports = PetPetshopLink;
