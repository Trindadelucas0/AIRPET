const { query } = require('../config/database');

const ManualBoost = {
  async listarAtivosPorPet(limite = 200) {
    const resultado = await query(
      `SELECT mb.id,
              mb.target_type,
              mb.target_id,
              mb.boost_value,
              mb.reason,
              mb.starts_at,
              mb.ends_at,
              mb.created_at,
              pet.nome AS pet_nome,
              pet.foto AS pet_foto,
              dono.id AS dono_id,
              dono.nome AS dono_nome,
              dono.foto_perfil AS dono_foto
       FROM manual_boosts mb
       LEFT JOIN pets pet ON mb.target_type = 'pet' AND pet.id = mb.target_id
       LEFT JOIN usuarios dono ON dono.id = pet.usuario_id
       WHERE mb.target_type = 'pet'
       ORDER BY mb.created_at DESC
       LIMIT $1`,
      [limite]
    );
    return resultado.rows;
  },

  async criar({ target_type, target_id, boost_value, reason, duracao_horas, created_by_admin }) {
    await query(
      `INSERT INTO manual_boosts
         (target_type, target_id, boost_value, reason, starts_at, ends_at, created_by_admin)
       VALUES
         ($1, $2, $3, $4, NOW(), NOW() + ($5 || ' hours')::interval, $6)`,
      [target_type, target_id, boost_value, reason || null, duracao_horas, created_by_admin]
    );
  },

  async encerrarAgora(id) {
    await query(
      `UPDATE manual_boosts
       SET ends_at = NOW()
       WHERE id = $1`,
      [id]
    );
  },
};

module.exports = ManualBoost;
