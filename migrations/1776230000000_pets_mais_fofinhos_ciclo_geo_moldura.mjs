export const shorthands = undefined;

/**
 * Pets mais fofinhos (evolução Pet do mês):
 * - Ciclo por edição: duracao_dias, inicia_em, termina_em (liberta UNIQUE em mes_ref para vários ciclos)
 * - usuarios.pais para ranking geo
 * - publicacoes.fofinhos_moldura — destaque visual opcional no post
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pais VARCHAR(80);
  `);

  pgm.sql(`
    ALTER TABLE publicacoes ADD COLUMN IF NOT EXISTS fofinhos_moldura BOOLEAN NOT NULL DEFAULT false;
  `);

  pgm.sql(`
    ALTER TABLE pet_do_mes_edicoes ADD COLUMN IF NOT EXISTS duracao_dias INTEGER NOT NULL DEFAULT 30;
  `);
  pgm.sql(`
    ALTER TABLE pet_do_mes_edicoes ADD COLUMN IF NOT EXISTS inicia_em TIMESTAMPTZ;
  `);
  pgm.sql(`
    ALTER TABLE pet_do_mes_edicoes ADD COLUMN IF NOT EXISTS termina_em TIMESTAMPTZ;
  `);

  pgm.sql(`
    ALTER TABLE pet_do_mes_edicoes DROP CONSTRAINT IF EXISTS pet_do_mes_edicoes_mes_ref_key;
  `);

  pgm.sql(`
    UPDATE pet_do_mes_edicoes e
    SET
      inicia_em = COALESCE(inicia_em, (e.mes_ref::timestamp AT TIME ZONE 'UTC')),
      termina_em = COALESCE(termina_em, COALESCE(e.encerra_em, (e.mes_ref::timestamp AT TIME ZONE 'UTC') + INTERVAL '1 month' - INTERVAL '1 second')),
      duracao_dias = CASE WHEN duracao_dias IS NULL OR duracao_dias < 1 THEN 30 ELSE duracao_dias END
    WHERE inicia_em IS NULL OR termina_em IS NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pet_do_mes_edicoes_ativa_termina
      ON pet_do_mes_edicoes (termina_em DESC)
      WHERE estado = 'aberta';
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_pet_do_mes_edicoes_ativa_termina;`);
  pgm.sql(`
    ALTER TABLE pet_do_mes_edicoes DROP COLUMN IF EXISTS duracao_dias;
    ALTER TABLE pet_do_mes_edicoes DROP COLUMN IF EXISTS inicia_em;
    ALTER TABLE pet_do_mes_edicoes DROP COLUMN IF EXISTS termina_em;
  `);
  pgm.sql(`ALTER TABLE publicacoes DROP COLUMN IF EXISTS fofinhos_moldura;`);
  pgm.sql(`ALTER TABLE usuarios DROP COLUMN IF EXISTS pais;`);
  pgm.sql(`
    ALTER TABLE pet_do_mes_edicoes ADD CONSTRAINT pet_do_mes_edicoes_mes_ref_key UNIQUE (mes_ref);
  `);
}
