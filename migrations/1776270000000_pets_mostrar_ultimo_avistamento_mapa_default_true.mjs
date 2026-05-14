export const shorthands = undefined;

/**
 * Mapa publico (camada "Pets no mapa") passa a ser opt-out:
 *   - Default da coluna muda para true.
 *   - Backfill: todos os pets existentes ficam opt-in (true). Quem quiser ocultar
 *     desliga depois nas preferencias do pet.
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE pets
      ALTER COLUMN mostrar_ultimo_avistamento_mapa SET DEFAULT true;
    UPDATE pets
       SET mostrar_ultimo_avistamento_mapa = true
     WHERE mostrar_ultimo_avistamento_mapa IS DISTINCT FROM true;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    ALTER TABLE pets
      ALTER COLUMN mostrar_ultimo_avistamento_mapa SET DEFAULT false;
  `);
}
