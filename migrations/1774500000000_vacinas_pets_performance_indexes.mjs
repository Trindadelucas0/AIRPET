export const shorthands = undefined;

/**
 * Índices para reduzir latência de consultas de vacinas e joins com pets.
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_vacinas_data_proxima
    ON vacinas (data_proxima ASC);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_vacinas_pet_id
    ON vacinas (pet_id);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pets_usuario_id
    ON pets (usuario_id);
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_pets_usuario_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_vacinas_pet_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_vacinas_data_proxima;`);
}
