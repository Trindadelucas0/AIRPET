export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE pets_perdidos
      ADD COLUMN IF NOT EXISTS ciclo_alerta INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS last_level_changed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS pets_perdidos_alert_events (
      id BIGSERIAL PRIMARY KEY,
      pet_perdido_id INTEGER NOT NULL REFERENCES pets_perdidos(id) ON DELETE CASCADE,
      tipo VARCHAR(40) NOT NULL,
      nivel_antes INTEGER,
      nivel_depois INTEGER,
      ciclo_alerta INTEGER NOT NULL DEFAULT 1,
      origem VARCHAR(30) NOT NULL DEFAULT 'sistema',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pets_perdidos_alert_events_lookup
    ON pets_perdidos_alert_events (pet_perdido_id, created_at DESC);
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_pets_perdidos_alert_events_lookup;`);
  pgm.sql(`DROP TABLE IF EXISTS pets_perdidos_alert_events;`);
  pgm.sql(`
    ALTER TABLE pets_perdidos
      DROP COLUMN IF EXISTS last_broadcast_at,
      DROP COLUMN IF EXISTS last_level_changed_at,
      DROP COLUMN IF EXISTS ciclo_alerta;
  `);
}
