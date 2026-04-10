export const shorthands = undefined;

/**
 * Índices para hot paths da home pública sob alta concorrência:
 * - pets_perdidos aprovado + ordenação por data + join por pet_id
 * - contagem de pontos ativos
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pets_perdidos_aprovado_data_pet
    ON pets_perdidos (data DESC, pet_id)
    WHERE status = 'aprovado';
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pontos_mapa_ativo_true
    ON pontos_mapa (id)
    WHERE ativo = true;
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_pontos_mapa_ativo_true;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_pets_perdidos_aprovado_data_pet;`);
}
