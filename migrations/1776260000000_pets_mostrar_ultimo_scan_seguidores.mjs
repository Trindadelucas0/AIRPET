export const shorthands = undefined;

/**
 * Opt-out do tutor: último scan na camada "Seguindo" do mapa (só seguidores).
 * Default true. Pet perdido (status ou alerta aprovado) ignora este flag na query social.
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE pets ADD COLUMN IF NOT EXISTS mostrar_ultimo_scan_seguidores BOOLEAN NOT NULL DEFAULT true;
  `);
}

export async function down(pgm) {
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS mostrar_ultimo_scan_seguidores;`);
}
