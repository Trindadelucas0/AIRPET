const { query } = require('../config/database');

const PetPerdidoAlertEvent = {
  async registrar({
    pet_perdido_id,
    tipo,
    nivel_antes = null,
    nivel_depois = null,
    ciclo_alerta = 1,
    origem = 'sistema',
    metadata = {},
  }, client = null) {
    const executor = client || { query };
    const resultado = await executor.query(
      `INSERT INTO pets_perdidos_alert_events
        (pet_perdido_id, tipo, nivel_antes, nivel_depois, ciclo_alerta, origem, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        pet_perdido_id,
        tipo,
        nivel_antes,
        nivel_depois,
        ciclo_alerta || 1,
        origem || 'sistema',
        JSON.stringify(metadata || {}),
      ]
    );
    return resultado.rows[0] || null;
  },

  async listarPorAlerta(petPerdidoId, limite = 100) {
    const resultado = await query(
      `SELECT *
       FROM pets_perdidos_alert_events
       WHERE pet_perdido_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [petPerdidoId, Math.min(500, Math.max(1, Number(limite) || 100))]
    );
    return resultado.rows;
  },
};

module.exports = PetPerdidoAlertEvent;
