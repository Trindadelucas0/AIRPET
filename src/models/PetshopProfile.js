const { query } = require('../config/database');

const PetshopProfile = {
  async buscarPorPetshopId(petshopId) {
    const result = await query(`SELECT * FROM petshop_profiles WHERE petshop_id = $1`, [petshopId]);
    return result.rows[0];
  },

  async upsert(petshopId, dados) {
    const result = await query(
      `INSERT INTO petshop_profiles (
        petshop_id, slogan, descricao_curta, descricao_longa,
        instagram_url, facebook_url, website_url, whatsapp_publico, contato_link, aceita_agendamento
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (petshop_id) DO UPDATE SET
        slogan = EXCLUDED.slogan,
        descricao_curta = EXCLUDED.descricao_curta,
        descricao_longa = EXCLUDED.descricao_longa,
        instagram_url = EXCLUDED.instagram_url,
        facebook_url = EXCLUDED.facebook_url,
        website_url = EXCLUDED.website_url,
        whatsapp_publico = EXCLUDED.whatsapp_publico,
        contato_link = EXCLUDED.contato_link,
        aceita_agendamento = EXCLUDED.aceita_agendamento,
        data_atualizacao = NOW()
      RETURNING *`,
      [
        petshopId,
        dados.slogan || null,
        dados.descricao_curta || null,
        dados.descricao_longa || null,
        dados.instagram_url || null,
        dados.facebook_url || null,
        dados.website_url || null,
        dados.whatsapp_publico || null,
        dados.contato_link || null,
        dados.aceita_agendamento !== false,
      ]
    );
    return result.rows[0];
  },
};

module.exports = PetshopProfile;
