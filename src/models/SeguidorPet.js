const { query } = require('../config/database');

const SeguidorPet = {

  async seguir(usuarioId, petId) {
    const resultado = await query(
      `INSERT INTO seguidores_pets (usuario_id, pet_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, pet_id) DO NOTHING
       RETURNING *`,
      [usuarioId, petId]
    );
    return resultado.rows[0];
  },

  async deixarDeSeguir(usuarioId, petId) {
    const resultado = await query(
      `DELETE FROM seguidores_pets WHERE usuario_id = $1 AND pet_id = $2 RETURNING *`,
      [usuarioId, petId]
    );
    return resultado.rows[0];
  },

  async estaSeguindo(usuarioId, petId) {
    const resultado = await query(
      `SELECT 1 FROM seguidores_pets WHERE usuario_id = $1 AND pet_id = $2`,
      [usuarioId, petId]
    );
    return resultado.rows.length > 0;
  },

  async contarSeguidores(petId) {
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM seguidores_pets WHERE pet_id = $1`,
      [petId]
    );
    return resultado.rows[0].total;
  },

  async contarSeguindo(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM seguidores_pets WHERE usuario_id = $1`,
      [usuarioId]
    );
    return resultado.rows[0].total;
  },

  async listarSeguidores(petId, limite = 50) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, sp.criado_em
       FROM seguidores_pets sp
       JOIN usuarios u ON u.id = sp.usuario_id
       WHERE sp.pet_id = $1
       ORDER BY sp.criado_em DESC LIMIT $2`,
      [petId, limite]
    );
    return resultado.rows;
  },

  async listarPetsSeguidos(usuarioId, limite = 50) {
    const resultado = await query(
      `SELECT p.id, p.nome, p.foto, p.tipo, p.raca,
              u.id AS dono_id, u.nome AS dono_nome, u.cor_perfil AS dono_cor_perfil,
              sp.criado_em AS seguido_em
       FROM seguidores_pets sp
       JOIN pets p ON p.id = sp.pet_id
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE sp.usuario_id = $1
       ORDER BY sp.criado_em DESC LIMIT $2`,
      [usuarioId, limite]
    );
    return resultado.rows;
  },
};

module.exports = SeguidorPet;
