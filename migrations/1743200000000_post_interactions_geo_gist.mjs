export const shorthands = undefined;

/**
 * Indice espacial preventivo em post_interactions_raw.geo_point (PostGIS).
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_post_interactions_geo_point
    ON post_interactions_raw USING GIST (geo_point)
    WHERE geo_point IS NOT NULL;
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_post_interactions_geo_point;`);
}
