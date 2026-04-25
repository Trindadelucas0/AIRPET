/**
 * PetTrackingEvent.js — Event store unificado de rastreamento de pets
 *
 * Consolida eventos de localização de múltiplas fontes (tag NFC, avistamentos,
 * registros manuais) em uma timeline unificada orientada ao produto.
 *
 * Tipos de evento (event_type):
 *   nfc_scan        — tag NFC escaneada por alguém
 *   manual_location — tutor informou localização manualmente
 *   finder_report   — alguém avistou e enviou localização/foto
 *   status_change   — mudança de status perdido/seguro
 *
 * Visibilidade (visibility):
 *   owner  — apenas o dono vê
 *   public — visível no alerta público
 *
 * Tabela: pet_tracking_events
 */

const { query } = require('../config/database');

const PetTrackingEvent = {

  async registrar(dados) {
    const {
      pet_id, event_type, source = 'nfc',
      latitude, longitude, cidade,
      confidence = 100, visibility = 'owner',
      metadata,
    } = dados;

    try {
      const resultado = await query(
        `INSERT INTO pet_tracking_events
           (pet_id, event_type, source, latitude, longitude, cidade, confidence, visibility, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          pet_id, event_type, source,
          latitude ? parseFloat(latitude) : null,
          longitude ? parseFloat(longitude) : null,
          cidade || null,
          confidence,
          visibility,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
      return resultado.rows[0];
    } catch (_) {
      return null;
    }
  },

  async buscarPorPet(petId, { limite = 20, visibility = null } = {}) {
    try {
      const params = [petId, limite];
      let visFilter = '';
      if (visibility) {
        params.push(visibility);
        visFilter = `AND visibility = $${params.length}`;
      }
      const resultado = await query(
        `SELECT * FROM pet_tracking_events
         WHERE pet_id = $1 ${visFilter}
         ORDER BY event_at DESC
         LIMIT $2`,
        params
      );
      return resultado.rows;
    } catch (_) {
      return [];
    }
  },

  async ultimoEventoComCoordenadas(petId) {
    try {
      const resultado = await query(
        `SELECT * FROM pet_tracking_events
         WHERE pet_id = $1
           AND latitude IS NOT NULL
           AND longitude IS NOT NULL
         ORDER BY event_at DESC
         LIMIT 1`,
        [petId]
      );
      return resultado.rows[0] || null;
    } catch (_) {
      return null;
    }
  },
};

module.exports = PetTrackingEvent;
