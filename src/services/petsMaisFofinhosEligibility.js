const { query } = require('../config/database');

const MIN_POSTS_COM_MIDIA = 4;

function duracaoEdicaoDias() {
  const d = parseInt(process.env.PETS_MAIS_FOFINHOS_DIAS_EDICAO || '30', 10);
  return d === 15 || d === 30 ? d : 30;
}

/**
 * @param {number} petId
 * @returns {Promise<{ fotosComMidia: number, temPetshop: boolean, elegivel: boolean }>}
 */
async function detalheElegibilidadePet(petId) {
  const pid = parseInt(petId, 10);
  if (!Number.isFinite(pid) || pid < 1) {
    return { fotosComMidia: 0, temPetshop: false, elegivel: false };
  }
  const r = await query(
    `SELECT
       (SELECT COUNT(*)::int
        FROM publicacoes p2
        WHERE p2.pet_id = $1
          AND p2.tipo = 'original'
          AND (
            (p2.foto IS NOT NULL AND TRIM(p2.foto::text) <> '')
            OR EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p2.id)
          )
       ) AS fotos_com_midia,
       (
         EXISTS (
           SELECT 1 FROM pet_petshop_links l
           WHERE l.pet_id = $1 AND l.ativo = true
         )
         OR EXISTS (
           SELECT 1 FROM pets px WHERE px.id = $1 AND px.petshop_vinculado_id IS NOT NULL
         )
       ) AS tem_petshop`,
    [pid]
  );
  const row = r.rows[0] || { fotos_com_midia: 0, tem_petshop: false };
  const fotos = row.fotos_com_midia || 0;
  const temPetshop = !!row.tem_petshop;
  return {
    fotosComMidia: fotos,
    temPetshop,
    elegivel: fotos >= MIN_POSTS_COM_MIDIA && temPetshop,
  };
}

/**
 * @param {number[]} petIds
 * @returns {Promise<Set<number>>}
 */
async function petsElegiveisIds(petIds) {
  const ids = [...new Set((petIds || []).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return new Set();
  const r = await query(
    `SELECT p.id AS pet_id
     FROM pets p
     WHERE p.id = ANY($1::int[])
       AND (
         EXISTS (SELECT 1 FROM pet_petshop_links l WHERE l.pet_id = p.id AND l.ativo = true)
         OR p.petshop_vinculado_id IS NOT NULL
       )
       AND (
         SELECT COUNT(*)::int
         FROM publicacoes p2
         WHERE p2.pet_id = p.id
           AND p2.tipo = 'original'
           AND (
             (p2.foto IS NOT NULL AND TRIM(p2.foto::text) <> '')
             OR EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p2.id)
           )
       ) >= $2`,
    [ids, MIN_POSTS_COM_MIDIA]
  );
  return new Set((r.rows || []).map((row) => row.pet_id));
}

module.exports = {
  MIN_POSTS_COM_MIDIA,
  duracaoEdicaoDias,
  detalheElegibilidadePet,
  petsElegiveisIds,
};
