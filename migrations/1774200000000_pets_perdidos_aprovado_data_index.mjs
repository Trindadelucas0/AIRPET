export const shorthands = undefined;

/**
 * Índice parcial para o cron de escalonamento de alertas:
 * WHERE status = 'aprovado' ORDER BY data ASC (schedulerService).
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pets_perdidos_aprovado_data
    ON pets_perdidos (data ASC)
    WHERE status = 'aprovado';
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_pets_perdidos_aprovado_data;`);
}
