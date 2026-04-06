export const shorthands = undefined;

/**
 * Tabelas de métricas da app (contador HTTP, agregado de storage, meta).
 * Usadas por src/services/metrics/metricsStore/postgresStore.js
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS app_metrics_counter (
      name VARCHAR(100) PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS app_metrics_storage_aggregate (
      id INTEGER PRIMARY KEY,
      total_bytes BIGINT NOT NULL DEFAULT 0,
      total_objects BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS app_metrics_meta (
      key VARCHAR(200) PRIMARY KEY,
      value_text TEXT,
      value_timestamptz TIMESTAMPTZ
    );
  `);

  pgm.sql(`
    INSERT INTO app_metrics_counter (name, value, updated_at)
    VALUES ('http_access_total', 0, NOW())
    ON CONFLICT (name) DO NOTHING;
  `);

  pgm.sql(`
    INSERT INTO app_metrics_storage_aggregate (id, total_bytes, total_objects, updated_at)
    VALUES (1, 0, 0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP TABLE IF EXISTS app_metrics_meta;`);
  pgm.sql(`DROP TABLE IF EXISTS app_metrics_counter;`);
  pgm.sql(`DROP TABLE IF EXISTS app_metrics_storage_aggregate;`);
}
