const { query } = require('../config/database');

const PetCheckin = {
  async criar({ pet_id, autor_user_id, publicacao_id, lat, lng, precisao = 'bairro', local_nome = null }) {
    const la = parseFloat(lat);
    const lo = parseFloat(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    const r = await query(
      `INSERT INTO pet_checkins (pet_id, autor_user_id, publicacao_id, geo_point, precisao, local_nome)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7)
       RETURNING *`,
      [pet_id, autor_user_id, publicacao_id || null, lo, la, precisao, local_nome]
    );
    return r.rows[0];
  },

  async listarPinsPublicosSeguidos(usuarioId, limite = 80) {
    const r = await query(
      `SELECT pc.pet_id, p.nome AS pet_nome, p.foto AS pet_foto, p.slug AS pet_slug,
              ST_Y(pc.geo_point::geometry) AS lat,
              ST_X(pc.geo_point::geometry) AS lng,
              pc.criado_em,
              pc.local_nome
       FROM pet_checkins pc
       JOIN pets p ON p.id = pc.pet_id
       WHERE pc.criado_em > NOW() - INTERVAL '30 days'
         AND (
           p.usuario_id = $1
           OR (
             EXISTS (
               SELECT 1 FROM seguidores_pets sp
               WHERE sp.pet_id = pc.pet_id AND sp.usuario_id = $1
             )
             AND NOT COALESCE(p.privado, false)
             AND (
               COALESCE(p.mostrar_ultimo_scan_seguidores, true) = true
               OR p.status = 'perdido'
               OR EXISTS (
                 SELECT 1 FROM pets_perdidos pp
                 WHERE pp.pet_id = p.id AND pp.status = 'aprovado'
               )
             )
           )
         )
       ORDER BY pc.criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return r.rows;
  },
};

module.exports = PetCheckin;
