const { query } = require('../config/database');

const PetshopPartnerRequest = {
  async criar(dados) {
    const result = await query(
      `INSERT INTO petshop_partner_requests (
        petshop_id,
        status, empresa_nome, empresa_documento, responsavel_nome, responsavel_cargo,
        telefone, email, endereco, bairro, cidade, estado, cep, latitude, longitude,
        localizacao, redes_sociais, servicos, horario_funcionamento, descricao, logo_url, fotos_urls
      )
      VALUES (
        $1, 'pendente', $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13::numeric, $14::numeric,
        CASE
          WHEN $13::numeric IS NOT NULL AND $14::numeric IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($14::double precision, $13::double precision), 4326)::geography
          ELSE NULL
        END,
        $15::jsonb, $16::jsonb, $17::jsonb, $18, $19, $20
      )
      RETURNING *`,
      [
        dados.petshop_id || null,
        dados.empresa_nome,
        dados.empresa_documento || null,
        dados.responsavel_nome,
        dados.responsavel_cargo || null,
        dados.telefone,
        dados.email,
        dados.endereco,
        dados.bairro || null,
        dados.cidade || null,
        dados.estado || null,
        dados.cep || null,
        dados.latitude ?? null,
        dados.longitude ?? null,
        JSON.stringify(dados.redes_sociais || {}),
        JSON.stringify(dados.servicos || []),
        JSON.stringify(dados.horario_funcionamento || {}),
        dados.descricao || null,
        dados.logo_url || null,
        dados.fotos_urls || [],
      ]
    );
    return result.rows[0];
  },

  async listarPorStatus(status = 'pendente') {
    const result = await query(
      `SELECT *
       FROM petshop_partner_requests
       WHERE status = $1
       ORDER BY data_criacao ASC`,
      [status]
    );
    return result.rows;
  },

  async listarTodas() {
    const result = await query(
      `SELECT * FROM petshop_partner_requests ORDER BY data_criacao DESC`
    );
    return result.rows;
  },

  async buscarPorId(id) {
    const result = await query(`SELECT * FROM petshop_partner_requests WHERE id = $1`, [id]);
    return result.rows[0];
  },

  async buscarPorPetshopId(petshopId) {
    const result = await query(
      `SELECT *
       FROM petshop_partner_requests
       WHERE petshop_id = $1
       ORDER BY data_criacao DESC
       LIMIT 1`,
      [petshopId]
    );
    return result.rows[0] || null;
  },

  async atualizarStatus(id, status, observacoes_admin = null, motivo_rejeicao = null, adminEmail = null) {
    const result = await query(
      `UPDATE petshop_partner_requests
       SET status = $2,
           observacoes_admin = COALESCE($3, observacoes_admin),
           motivo_rejeicao = COALESCE($4, motivo_rejeicao),
           analisado_por_email = $5,
           analisado_em = NOW(),
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, observacoes_admin, motivo_rejeicao, adminEmail]
    );
    return result.rows[0];
  },
};

module.exports = PetshopPartnerRequest;
