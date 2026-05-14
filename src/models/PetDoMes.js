const { query } = require('../config/database');
const { duracaoEdicaoDias } = require('../services/petsMaisFofinhosEligibility');

const NIVEIS = new Set(['bairro', 'cidade', 'estado', 'pais', 'nacional']);

function norm(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
}

function sqlPetElegivel(petAlias) {
  return `(
    EXISTS (SELECT 1 FROM pet_petshop_links l WHERE l.pet_id = ${petAlias}.id AND l.ativo = true)
    OR ${petAlias}.petshop_vinculado_id IS NOT NULL
  )
  AND (
    SELECT COUNT(*)::int
    FROM publicacoes p2
    WHERE p2.pet_id = ${petAlias}.id
      AND p2.tipo = 'original'
      AND (
        (p2.foto IS NOT NULL AND TRIM(p2.foto::text) <> '')
        OR EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p2.id)
      )
  ) >= 4`;
}

const PetDoMes = {
  async buscarOuCriarEdicaoMesAtual() {
    return PetDoMes.buscarOuCriarEdicaoAtiva();
  },

  async buscarOuCriarEdicaoAtiva() {
    const dur = duracaoEdicaoDias();

    await query(
      `UPDATE pet_do_mes_edicoes
       SET estado = 'encerrada'
       WHERE estado = 'aberta'
         AND termina_em IS NOT NULL
         AND termina_em < NOW()`
    );

    const r = await query(
      `SELECT * FROM pet_do_mes_edicoes
       WHERE estado = 'aberta'
         AND (termina_em IS NULL OR termina_em >= NOW())
       ORDER BY id DESC
       LIMIT 1`
    );
    if (r.rows[0]) return r.rows[0];

    await query(`UPDATE pet_do_mes_edicoes SET estado = 'encerrada' WHERE estado = 'aberta'`);

    const ins = await query(
      `INSERT INTO pet_do_mes_edicoes (
         mes_ref, estado, vencedor_pet_id, encerra_em, data_criacao, duracao_dias, inicia_em, termina_em
       )
       VALUES (
         (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
         'aberta',
         NULL,
         NOW() + ($1 * INTERVAL '1 day'),
         NOW(),
         $1,
         NOW(),
         NOW() + ($1 * INTERVAL '1 day')
       )
       RETURNING *`,
      [dur]
    );
    return ins.rows[0] || null;
  },

  /**
   * Ranking por nível geo (nacional = todos os elegíveis com votos).
   * @param {number} edicaoId
   * @param {string} nivel bairro|cidade|estado|pais|nacional
   * @param {object|null} viewerUsuario — linha usuario (bairro, cidade, estado, pais)
   * @param {number} limite
   */
  async listarRankingPorNivel(edicaoId, nivel, viewerUsuario, limite = 40) {
    const n = String(nivel || 'nacional').toLowerCase();
    const nivelOk = NIVEIS.has(n) ? n : 'nacional';
    const lim = Math.min(Math.max(parseInt(limite, 10) || 40, 1), 80);
    const v = viewerUsuario || {};

    let geoClause = 'TRUE';
    const params = [edicaoId, lim];

    if (nivelOk === 'bairro') {
      const b = norm(v.bairro);
      if (b) {
        geoClause = `LOWER(TRIM(COALESCE(u.bairro, ''))) = $3`;
        params.push(b);
      }
    } else if (nivelOk === 'cidade') {
      const c = norm(v.cidade);
      if (c) {
        geoClause = `LOWER(TRIM(COALESCE(u.cidade, ''))) = $3`;
        params.push(c);
      }
    } else if (nivelOk === 'estado') {
      const e = norm(v.estado);
      if (e) {
        geoClause = `LOWER(TRIM(COALESCE(u.estado, ''))) = $3`;
        params.push(e);
      }
    } else if (nivelOk === 'pais') {
      const p = norm(v.pais);
      if (p) {
        geoClause = `LOWER(TRIM(COALESCE(u.pais, ''))) = $3`;
        params.push(p);
      }
    }

    const elig = sqlPetElegivel('pet');

    const sql = `
      SELECT v.pet_id, COUNT(*)::int AS votos
      FROM pet_do_mes_votos v
      JOIN pets pet ON pet.id = v.pet_id
      JOIN usuarios u ON u.id = pet.usuario_id
      WHERE v.edicao_id = $1
        AND (${elig})
        AND (${geoClause})
      GROUP BY v.pet_id
      ORDER BY votos DESC, v.pet_id ASC
      LIMIT $2
    `;
    const r = await query(sql, params);
    return r.rows;
  },

  async listarRanking(edicaoId, limite = 10) {
    return PetDoMes.listarRankingPorNivel(edicaoId, 'nacional', {}, limite);
  },

  async listarRankingComCapaPorNivel(edicaoId, nivel, viewerUsuario, limite = 24) {
    const ranked = await PetDoMes.listarRankingPorNivel(edicaoId, nivel, viewerUsuario, limite);
    if (!ranked.length) return [];

    const ids = ranked.map((x) => x.pet_id);
    const capas = await query(
      `SELECT DISTINCT ON (pub.pet_id)
         pub.pet_id,
         COALESCE(
           (SELECT pm.media_url FROM post_media pm WHERE pm.post_id = pub.id ORDER BY pm.order_index ASC LIMIT 1),
           pub.foto
         ) AS media_url
       FROM publicacoes pub
       WHERE pub.pet_id = ANY($1::int[])
         AND pub.tipo = 'original'
         AND (
           (pub.foto IS NOT NULL AND TRIM(pub.foto::text) <> '')
           OR EXISTS (SELECT 1 FROM post_media pm2 WHERE pm2.post_id = pub.id)
         )
       ORDER BY pub.pet_id, pub.criado_em DESC`,
      [ids]
    );
    const byPet = {};
    (capas.rows || []).forEach((row) => {
      byPet[row.pet_id] = row.media_url || null;
    });
    return ranked.map((row) => ({
      pet_id: row.pet_id,
      votos: row.votos,
      media_url: byPet[row.pet_id] || null,
    }));
  },

  async posicaoPetNoRanking(edicaoId, petId, nivel, viewerUsuario) {
    const pid = parseInt(petId, 10);
    if (!Number.isFinite(pid) || pid < 1) return null;
    const rows = await PetDoMes.listarRankingPorNivel(edicaoId, nivel, viewerUsuario, 500);
    const idx = rows.findIndex((r) => parseInt(r.pet_id, 10) === pid);
    return idx >= 0 ? idx + 1 : null;
  },

  async votar(edicaoId, petId, userId) {
    await query(
      `INSERT INTO pet_do_mes_votos (edicao_id, pet_id, user_id) VALUES ($1, $2, $3)
       ON CONFLICT (edicao_id, user_id) DO UPDATE SET pet_id = EXCLUDED.pet_id, criado_em = NOW()`,
      [edicaoId, petId, userId]
    );
  },

  async usuarioVoto(edicaoId, userId) {
    const r = await query(
      `SELECT pet_id FROM pet_do_mes_votos WHERE edicao_id = $1 AND user_id = $2`,
      [edicaoId, userId]
    );
    return r.rows[0] || null;
  },
};

module.exports = PetDoMes;
