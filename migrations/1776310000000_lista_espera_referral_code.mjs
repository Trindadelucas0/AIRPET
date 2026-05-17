export const shorthands = undefined;

/**
 * Código curto de indicação para o funil lista de espera.
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE lista_espera
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16);
  `);
  pgm.sql(`
    UPDATE lista_espera
    SET referral_code = substr(md5(id::text || '::airpet::' || coalesce(email, '')), 1, 12)
    WHERE referral_code IS NULL OR referral_code = '';
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_espera_referral_code
      ON lista_espera (referral_code)
      WHERE referral_code IS NOT NULL;
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_lista_espera_referral_code;`);
  pgm.sql(`ALTER TABLE lista_espera DROP COLUMN IF EXISTS referral_code;`);
}
