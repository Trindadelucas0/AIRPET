export const shorthands = undefined;

/**
 * Preferências de notificação por usuário (e opcionalmente por pet).
 *
 * Antes desta tabela, o controller persistia em `req.session.notifPrefs` —
 * preferências "esqueciam" no próximo login ou em outro device. A UI ainda
 * mostrava badges "Sempre ativo" / "Lembrete..." que produto sugeriam
 * persistência durável: corrigimos isso aqui.
 *
 * Modelo:
 *  - 1 linha por (usuario_id, pet_id). pet_id NULL = preferência "global"
 *    do usuário (aplica a todos os pets que não tenham override).
 *  - Campos não-nulos têm default igual ao comportamento atual (opt-in).
 *  - Resumo semanal e horário quieto também viram colunas próprias.
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notif_preferencias (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
      notif_racao BOOLEAN NOT NULL DEFAULT TRUE,
      racao_dias INTEGER NOT NULL DEFAULT 30,
      notif_peso BOOLEAN NOT NULL DEFAULT TRUE,
      peso_dias INTEGER NOT NULL DEFAULT 30,
      notif_agenda_48h BOOLEAN NOT NULL DEFAULT TRUE,
      notif_agenda_2h BOOLEAN NOT NULL DEFAULT TRUE,
      resumo_semanal BOOLEAN NOT NULL DEFAULT TRUE,
      horario_quieto BOOLEAN NOT NULL DEFAULT FALSE,
      quieto_inicio_h SMALLINT NOT NULL DEFAULT 23,
      quieto_fim_h SMALLINT NOT NULL DEFAULT 7,
      receber_alertas_pet_perdido BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_preferencias_usuario_pet
    ON notif_preferencias (usuario_id, COALESCE(pet_id, 0));
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_notif_preferencias_usuario
    ON notif_preferencias (usuario_id);
  `);
}

export async function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS notif_preferencias;');
}
