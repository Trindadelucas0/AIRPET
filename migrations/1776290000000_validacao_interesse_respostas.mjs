export const shorthands = undefined;

/**
 * Campos do wizard de validação /proteger-meu-pet/inscricao
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE validacao_interesse
      ADD COLUMN IF NOT EXISTS nome VARCHAR(120),
      ADD COLUMN IF NOT EXISTS telefone VARCHAR(30),
      ADD COLUMN IF NOT EXISTS cidade VARCHAR(80),
      ADD COLUMN IF NOT EXISTS estado CHAR(2),
      ADD COLUMN IF NOT EXISTS respostas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS wizard_completo BOOLEAN NOT NULL DEFAULT false;
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_validacao_interesse_wizard_completo
      ON validacao_interesse (wizard_completo, data_criacao DESC);
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_validacao_interesse_wizard_completo;`);
  pgm.sql(`
    ALTER TABLE validacao_interesse
      DROP COLUMN IF EXISTS wizard_completo,
      DROP COLUMN IF EXISTS respostas_json,
      DROP COLUMN IF EXISTS estado,
      DROP COLUMN IF EXISTS cidade,
      DROP COLUMN IF EXISTS telefone,
      DROP COLUMN IF EXISTS nome;
  `);
}
