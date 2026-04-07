/**
 * FotoPerfilPet.js — Fotos da galeria do perfil do tutor, vinculadas a um pet.
 * Tabela: fotos_perfil_pet (usuario_id, pet_id, foto, ordem, criado_em)
 */

const { query } = require('../config/database');

const MAX_FOTOS_POR_PET = 10;

const FotoPerfilPet = {

  async criar(usuario_id, pet_id, foto) {
    const resultado = await query(
      `INSERT INTO fotos_perfil_pet (usuario_id, pet_id, foto, ordem)
       SELECT $1, $2, $3, COALESCE((SELECT MAX(ordem) FROM fotos_perfil_pet WHERE usuario_id = $1 AND pet_id = $2), 0) + 1
       RETURNING *`,
      [usuario_id, pet_id, foto]
    );
    return resultado.rows[0];
  },

  async listarPorUsuario(usuario_id) {
    const resultado = await query(
      `SELECT f.*, p.nome AS pet_nome, p.foto AS pet_foto
       FROM fotos_perfil_pet f
       JOIN pets p ON p.id = f.pet_id
       WHERE f.usuario_id = $1
       ORDER BY p.nome, f.ordem, f.criado_em`,
      [usuario_id]
    );
    return resultado.rows;
  },

  async listarPorPet(pet_id) {
    const resultado = await query(
      `SELECT * FROM fotos_perfil_pet WHERE pet_id = $1 ORDER BY ordem, criado_em`,
      [pet_id]
    );
    return resultado.rows;
  },

  async listarPorPets(petIds = []) {
    if (!Array.isArray(petIds) || !petIds.length) return [];
    const resultado = await query(
      `SELECT *
       FROM fotos_perfil_pet
       WHERE pet_id = ANY($1::int[])
       ORDER BY ordem ASC, criado_em DESC`,
      [petIds]
    );
    return resultado.rows;
  },

  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM fotos_perfil_pet WHERE id = $1`,
      [id]
    );
    return resultado.rows[0];
  },

  async deletar(id, usuario_id) {
    const resultado = await query(
      `DELETE FROM fotos_perfil_pet WHERE id = $1 AND usuario_id = $2 RETURNING *`,
      [id, usuario_id]
    );
    return resultado.rows[0];
  },

  async contarPorPet(usuario_id, pet_id) {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM fotos_perfil_pet WHERE usuario_id = $1 AND pet_id = $2`,
      [usuario_id, pet_id]
    );
    return parseInt(resultado.rows[0].total, 10);
  },
};

FotoPerfilPet.MAX_FOTOS_POR_PET = MAX_FOTOS_POR_PET;
module.exports = FotoPerfilPet;
