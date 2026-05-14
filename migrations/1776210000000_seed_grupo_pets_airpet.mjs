export const shorthands = undefined;

/** Garante um grupo público demo para quem já rodou 177620 antes do seed embutido. */
export async function up(pgm) {
  pgm.sql(`
    INSERT INTO grupos (slug, nome, descricao, tipo, privacidade, membros_count)
    VALUES ('pets-do-airpet', 'Pets do AIRPET', 'Grupo geral da comunidade.', 'tema', 'aberto', 0)
    ON CONFLICT (slug) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.sql(`DELETE FROM grupos WHERE slug = 'pets-do-airpet';`);
}
