export const shorthands = undefined;

/**
 * Leads da landing /proteger-meu-pet (validação de interesse).
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS validacao_interesse (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      origem VARCHAR(64) NOT NULL DEFAULT 'proteger-meu-pet',
      user_agent TEXT,
      ip_hash VARCHAR(64),
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_validacao_interesse_email_origem
      ON validacao_interesse (email, origem);
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_validacao_interesse_data_criacao
      ON validacao_interesse (data_criacao DESC);
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_validacao_interesse_data_criacao;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_validacao_interesse_email_origem;`);
  pgm.sql(`DROP TABLE IF EXISTS validacao_interesse;`);
}
