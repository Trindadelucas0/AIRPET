/**
 * PetStatusHistory.js — Auditoria de mudanças de status do pet
 *
 * Registra cada alternância de status (perdido ↔ seguro) com actor,
 * motivo, localização e timestamp. Permite análise de tempo até
 * recuperação (MTTF — mean time to find) e funis de conversão.
 *
 * Tabela: pet_status_history
 * Campos: id, pet_id, usuario_id, old_status, new_status,
 *         descricao, latitude, longitude, recompensa, created_at
 */

const { query } = require('../config/database');

const PetStatusHistory = {

  async registrar(dados) {
    const { pet_id, usuario_id, old_status, new_status, descricao, latitude, longitude, recompensa } = dados;
    try {
      const resultado = await query(
        `INSERT INTO pet_status_history
           (pet_id, usuario_id, old_status, new_status, descricao, latitude, longitude, recompensa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [pet_id, usuario_id || null, old_status || null, new_status, descricao || null,
          latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, recompensa || null]
      );
      return resultado.rows[0];
    } catch (_) {
      // Tabela ainda pode não existir antes da migração. Falha silenciosa.
      return null;
    }
  },

  async buscarPorPet(petId, limite = 20) {
    try {
      const resultado = await query(
        `SELECT sh.*, u.nome AS usuario_nome
         FROM pet_status_history sh
         LEFT JOIN usuarios u ON u.id = sh.usuario_id
         WHERE sh.pet_id = $1
         ORDER BY sh.created_at DESC
         LIMIT $2`,
        [petId, limite]
      );
      return resultado.rows;
    } catch (_) {
      return [];
    }
  },

  async calcularTempoRecuperacao(petId) {
    try {
      const resultado = await query(
        `SELECT
           sh_lost.created_at AS perdido_em,
           sh_found.created_at AS encontrado_em,
           EXTRACT(EPOCH FROM (sh_found.created_at - sh_lost.created_at)) AS segundos
         FROM pet_status_history sh_lost
         JOIN pet_status_history sh_found
           ON sh_found.pet_id = sh_lost.pet_id
           AND sh_found.new_status = 'seguro'
           AND sh_found.created_at > sh_lost.created_at
         WHERE sh_lost.pet_id = $1
           AND sh_lost.new_status = 'perdido'
         ORDER BY sh_lost.created_at DESC
         LIMIT 5`,
        [petId]
      );
      return resultado.rows;
    } catch (_) {
      return [];
    }
  },
};

module.exports = PetStatusHistory;
