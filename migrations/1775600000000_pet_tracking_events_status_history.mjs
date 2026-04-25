export const shorthands = undefined;

/**
 * Migração: pet_tracking_events + pet_status_history
 *
 * pet_tracking_events — event store unificado de rastreamento
 *   Une dados de tag_scans, localizacoes e avistamentos em uma única
 *   tabela orientada a produto (timeline pública/privada do pet).
 *
 * pet_status_history — auditoria de mudanças de status (perdido/seguro)
 *   Registra cada alternância de status com actor, motivo e timestamp,
 *   permitindo análise de tempo até recuperação e funis de conversão.
 */
export async function up(pgm) {
  pgm.sql(`
    -- ── pet_tracking_events ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pet_tracking_events (
      id              BIGSERIAL PRIMARY KEY,
      pet_id          INTEGER   NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      event_type      VARCHAR(40) NOT NULL,
      source          VARCHAR(30) NOT NULL DEFAULT 'nfc',
      latitude        NUMERIC(10,6),
      longitude       NUMERIC(10,6),
      cidade          VARCHAR(120),
      confidence      SMALLINT DEFAULT 100,
      visibility      VARCHAR(20) NOT NULL DEFAULT 'owner',
      metadata        JSONB,
      event_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_pet_tracking_events_pet_at
      ON pet_tracking_events(pet_id, event_at DESC);

    CREATE INDEX IF NOT EXISTS idx_pet_tracking_events_type
      ON pet_tracking_events(event_type, event_at DESC);

    -- Índice geoespacial para consultas de proximidade futuras
    CREATE INDEX IF NOT EXISTS idx_pet_tracking_events_geo
      ON pet_tracking_events(latitude, longitude)
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    -- ── pet_status_history ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pet_status_history (
      id          BIGSERIAL PRIMARY KEY,
      pet_id      INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      old_status  VARCHAR(20),
      new_status  VARCHAR(20) NOT NULL,
      descricao   TEXT,
      latitude    NUMERIC(10,6),
      longitude   NUMERIC(10,6),
      recompensa  VARCHAR(80),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_pet_status_history_pet_at
      ON pet_status_history(pet_id, created_at DESC);
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS pet_tracking_events;
    DROP TABLE IF EXISTS pet_status_history;
  `);
}
