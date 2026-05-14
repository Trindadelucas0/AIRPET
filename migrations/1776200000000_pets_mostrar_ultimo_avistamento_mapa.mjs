export const shorthands = undefined;

/**
 * Opt-in do tutor para exibir o último avistamento (scan NFC) do pet no mapa público.
 * Pets perdidos continuam visíveis pela regra existente; ativos só com flag + perfil não privado.
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE pets ADD COLUMN IF NOT EXISTS mostrar_ultimo_avistamento_mapa BOOLEAN NOT NULL DEFAULT false;
  `);
}

export async function down(pgm) {
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS mostrar_ultimo_avistamento_mapa;`);
}
