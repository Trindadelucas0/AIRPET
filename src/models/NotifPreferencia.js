/**
 * NotifPreferencia — persistência das preferências de notificação por usuário.
 *
 * Modelo:
 *   - 1 linha por (usuario_id, pet_id). pet_id NULL = preferência global do
 *     usuário (aplica a todos os pets que não tenham override).
 *   - Em UPSERT, normalizamos pet_id NULL para 0 dentro do índice único
 *     (definido em migration com COALESCE(pet_id, 0)).
 *
 * Defaults coerentes com o que a UI já promete: tudo opt-in (true) e janelas
 * sensatas (ração/peso a cada 30d, agenda 48h+2h, horário quieto 23h–7h).
 */

const { query } = require('../config/database');

const DEFAULTS = Object.freeze({
  notif_racao: true,
  racao_dias: 30,
  notif_peso: true,
  peso_dias: 30,
  notif_agenda_48h: true,
  notif_agenda_2h: true,
  resumo_semanal: true,
  horario_quieto: false,
  quieto_inicio_h: 23,
  quieto_fim_h: 7,
  receber_alertas_pet_perdido: true,
});

function toBool(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return ['1', 'true', 'on', 'yes'].includes(String(v).toLowerCase());
}

function toInt(v, fallback, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  if (typeof min === 'number' && n < min) return min;
  if (typeof max === 'number' && n > max) return max;
  return n;
}

const NotifPreferencia = {
  DEFAULTS,

  async buscarParaUsuario(usuarioId, petId = null) {
    const params = petId ? [usuarioId, petId] : [usuarioId];
    const whereClausePet = petId ? 'pet_id = $2' : 'pet_id IS NULL';
    const r = await query(
      `SELECT * FROM notif_preferencias
       WHERE usuario_id = $1 AND ${whereClausePet}
       LIMIT 1`,
      params
    );
    if (r.rows[0]) return r.rows[0];
    return { usuario_id: usuarioId, pet_id: petId, ...DEFAULTS };
  },

  /**
   * UPSERT: cria ou atualiza preferências para (usuario_id, pet_id).
   * Aceita campos parciais; campos não presentes mantêm o default.
   */
  async salvar(usuarioId, prefs = {}) {
    const petId = prefs.pet_id ? parseInt(prefs.pet_id, 10) : null;
    const row = {
      notif_racao: toBool(prefs.notif_racao, DEFAULTS.notif_racao),
      racao_dias: toInt(prefs.racao_dias, DEFAULTS.racao_dias, 1, 365),
      notif_peso: toBool(prefs.notif_peso, DEFAULTS.notif_peso),
      peso_dias: toInt(prefs.peso_dias, DEFAULTS.peso_dias, 1, 365),
      notif_agenda_48h: toBool(prefs.notif_agenda_48h ?? prefs.notif_48h, DEFAULTS.notif_agenda_48h),
      notif_agenda_2h: toBool(prefs.notif_agenda_2h ?? prefs.notif_2h, DEFAULTS.notif_agenda_2h),
      resumo_semanal: toBool(prefs.resumo_semanal, DEFAULTS.resumo_semanal),
      horario_quieto: toBool(prefs.horario_quieto, DEFAULTS.horario_quieto),
      quieto_inicio_h: toInt(prefs.quieto_inicio_h ?? prefs.quieto_inicio, DEFAULTS.quieto_inicio_h, 0, 23),
      quieto_fim_h: toInt(prefs.quieto_fim_h ?? prefs.quieto_fim, DEFAULTS.quieto_fim_h, 0, 23),
      receber_alertas_pet_perdido: toBool(
        prefs.receber_alertas_pet_perdido,
        DEFAULTS.receber_alertas_pet_perdido
      ),
    };

    // Tenta UPDATE primeiro (mantendo precisão entre pet_id null vs valor).
    const whereClausePet = petId ? 'pet_id = $2' : 'pet_id IS NULL';
    const params = petId ? [usuarioId, petId] : [usuarioId];
    const updated = await query(
      `UPDATE notif_preferencias
       SET notif_racao = $${params.length + 1},
           racao_dias = $${params.length + 2},
           notif_peso = $${params.length + 3},
           peso_dias = $${params.length + 4},
           notif_agenda_48h = $${params.length + 5},
           notif_agenda_2h = $${params.length + 6},
           resumo_semanal = $${params.length + 7},
           horario_quieto = $${params.length + 8},
           quieto_inicio_h = $${params.length + 9},
           quieto_fim_h = $${params.length + 10},
           receber_alertas_pet_perdido = $${params.length + 11},
           atualizado_em = NOW()
       WHERE usuario_id = $1 AND ${whereClausePet}
       RETURNING *`,
      [
        ...params,
        row.notif_racao,
        row.racao_dias,
        row.notif_peso,
        row.peso_dias,
        row.notif_agenda_48h,
        row.notif_agenda_2h,
        row.resumo_semanal,
        row.horario_quieto,
        row.quieto_inicio_h,
        row.quieto_fim_h,
        row.receber_alertas_pet_perdido,
      ]
    );
    if (updated.rows[0]) return updated.rows[0];

    const inserted = await query(
      `INSERT INTO notif_preferencias (
         usuario_id, pet_id,
         notif_racao, racao_dias,
         notif_peso, peso_dias,
         notif_agenda_48h, notif_agenda_2h,
         resumo_semanal,
         horario_quieto, quieto_inicio_h, quieto_fim_h,
         receber_alertas_pet_perdido
       ) VALUES (
         $1, $2,
         $3, $4,
         $5, $6,
         $7, $8,
         $9,
         $10, $11, $12,
         $13
       )
       RETURNING *`,
      [
        usuarioId,
        petId,
        row.notif_racao,
        row.racao_dias,
        row.notif_peso,
        row.peso_dias,
        row.notif_agenda_48h,
        row.notif_agenda_2h,
        row.resumo_semanal,
        row.horario_quieto,
        row.quieto_inicio_h,
        row.quieto_fim_h,
        row.receber_alertas_pet_perdido,
      ]
    );
    return inserted.rows[0];
  },
};

module.exports = NotifPreferencia;
