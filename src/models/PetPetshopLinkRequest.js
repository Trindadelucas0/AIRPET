const { query, getClient } = require('../config/database');

const PetPetshopLinkRequest = {
  async criar({ pet_id, petshop_id, usuario_solicitante_id, mensagem }) {
    const result = await query(
      `INSERT INTO pet_petshop_link_requests
        (pet_id, petshop_id, usuario_solicitante_id, mensagem, status)
       VALUES ($1, $2, $3, $4, 'pendente')
       RETURNING *`,
      [pet_id, petshop_id, usuario_solicitante_id, mensagem || null]
    );
    return result.rows[0] || null;
  },

  async buscarPendente(petId, petshopId) {
    const result = await query(
      `SELECT *
         FROM pet_petshop_link_requests
        WHERE pet_id = $1
          AND petshop_id = $2
          AND status = 'pendente'
        ORDER BY created_at DESC
        LIMIT 1`,
      [petId, petshopId]
    );
    return result.rows[0] || null;
  },

  async listarPendentesPorPetshop(petshopId, limit = 50) {
    const result = await query(
      `SELECT r.*,
              p.nome AS pet_nome,
              p.foto AS pet_foto,
              u.id AS tutor_id,
              u.nome AS tutor_nome
         FROM pet_petshop_link_requests r
         JOIN pets p ON p.id = r.pet_id
         JOIN usuarios u ON u.id = p.usuario_id
        WHERE r.petshop_id = $1
          AND r.status = 'pendente'
        ORDER BY r.created_at DESC
        LIMIT $2`,
      [petshopId, limit]
    );
    return result.rows;
  },

  async marcarRecusada({ requestId, petshop_id, reviewed_by_petshop_account_id }) {
    const result = await query(
      `UPDATE pet_petshop_link_requests
          SET status = 'recusada',
              reviewed_at = NOW(),
              updated_at = NOW(),
              reviewed_by_petshop_account_id = $3
        WHERE id = $1
          AND petshop_id = $2
          AND status = 'pendente'
      RETURNING *`,
      [requestId, petshop_id, reviewed_by_petshop_account_id || null]
    );
    return result.rows[0] || null;
  },

  async aprovarComVinculo({ requestId, petshop_id, reviewed_by_petshop_account_id }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const requestRes = await client.query(
        `SELECT *
           FROM pet_petshop_link_requests
          WHERE id = $1
            AND petshop_id = $2
            AND status = 'pendente'
          FOR UPDATE`,
        [requestId, petshop_id]
      );
      const reqRow = requestRes.rows[0];
      if (!reqRow) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `INSERT INTO pet_petshop_links (pet_id, petshop_id, tipo_vinculo, ativo, is_principal, relevance_score)
         VALUES ($1, $2, 'cliente', true, false, 80)
         ON CONFLICT (pet_id, petshop_id) DO UPDATE SET
           ativo = true,
           data_atualizacao = NOW(),
           relevance_score = GREATEST(COALESCE(pet_petshop_links.relevance_score, 0), 80)`,
        [reqRow.pet_id, reqRow.petshop_id]
      );

      const approvedRes = await client.query(
        `UPDATE pet_petshop_link_requests
            SET status = 'aprovada',
                reviewed_at = NOW(),
                updated_at = NOW(),
                reviewed_by_petshop_account_id = $2
          WHERE id = $1
        RETURNING *`,
        [requestId, reviewed_by_petshop_account_id || null]
      );

      await client.query('COMMIT');
      return approvedRes.rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = PetPetshopLinkRequest;
