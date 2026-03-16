const { query } = require('../config/database');

const PetshopLostPetAlert = {
  async registrar({ pet_perdido_id, petshop_id, distancia_metros, origem = 'aprovacao_admin', canal = 'sistema', status_envio = 'enviado' }) {
    const result = await query(
      `INSERT INTO petshop_lost_pet_alerts (
        pet_perdido_id, petshop_id, distancia_metros, origem, canal, status_envio
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (pet_perdido_id, petshop_id, origem) DO UPDATE SET
        distancia_metros = EXCLUDED.distancia_metros,
        canal = EXCLUDED.canal,
        status_envio = EXCLUDED.status_envio
      RETURNING *`,
      [pet_perdido_id, petshop_id, distancia_metros || null, origem, canal, status_envio]
    );
    return result.rows[0];
  },
};

module.exports = PetshopLostPetAlert;
