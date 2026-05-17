const { query } = require('../config/database');

/** Tempo de vida público do story (autoexclusão da faixa após este período). */
const STORY_TTL_HOURS = 24;

const Story = {
  STORY_TTL_HOURS,

  async contarUltimas24h(petId) {
    const r = await query(
      `SELECT COUNT(*)::int AS n FROM stories
       WHERE pet_id = $1 AND criado_em > NOW() - $2::int * INTERVAL '1 hour'`,
      [petId, STORY_TTL_HOURS]
    );
    return r.rows[0].n;
  },

  async criar({ pet_id, autor_user_id, media_url, media_type = 'image', legenda = null }) {
    const n = await this.contarUltimas24h(pet_id);
    if (n >= 20) {
      const err = new Error('LIMITE_STORIES');
      err.code = 'LIMITE_STORIES';
      throw err;
    }
    const r = await query(
      `INSERT INTO stories (pet_id, autor_user_id, media_url, media_type, legenda, expira_em)
       VALUES ($1, $2, $3, $4, $5, NOW() + $6::int * INTERVAL '1 hour')
       RETURNING *`,
      [
        pet_id,
        autor_user_id,
        media_url,
        media_type,
        legenda ? String(legenda).slice(0, 280) : null,
        STORY_TTL_HOURS,
      ]
    );
    return r.rows[0];
  },

  /**
   * Oculta stories vencidos (expira_em passou). Mantém linhas para moderação.
   * @returns {Promise<number>} Quantidade de stories atualizados
   */
  async expirarVencidos() {
    const r = await query(
      `UPDATE stories
       SET visivel = false
       WHERE visivel = true AND expira_em < NOW()
       RETURNING id`
    );
    return r.rowCount || (r.rows && r.rows.length) || 0;
  },

  async listarAtivosParaPetsSeguidos(usuarioId, limite = 30) {
    const r = await query(
      `SELECT DISTINCT ON (s.pet_id)
         s.*, p.nome AS pet_nome, p.foto AS pet_foto, p.slug AS pet_slug
       FROM stories s
       JOIN pets p ON p.id = s.pet_id
       WHERE s.visivel = true AND s.expira_em > NOW() AND s.reportado = false
         AND NOT COALESCE(p.privado, false)
         AND (
           EXISTS (SELECT 1 FROM seguidores_pets sp WHERE sp.pet_id = s.pet_id AND sp.usuario_id = $1)
           OR p.usuario_id = $1
         )
       ORDER BY s.pet_id, s.criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );
    return r.rows;
  },

  async listarAtivosPorPet(petId, limite = 12) {
    const r = await query(
      `SELECT * FROM stories
       WHERE pet_id = $1 AND visivel = true AND expira_em > NOW() AND reportado = false
       ORDER BY criado_em DESC
       LIMIT $2`,
      [petId, limite]
    );
    return r.rows;
  },
};

module.exports = Story;
