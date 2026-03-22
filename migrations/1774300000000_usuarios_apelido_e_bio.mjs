export const shorthands = undefined;

/**
 * Bancos que rodaram baseline antigo podem não ter `apelido` (e às vezes `bio`).
 * atualizarPerfil() faz UPDATE nessas colunas — sem elas o salvamento do perfil falha.
 */
export async function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'bio'
      ) THEN
        ALTER TABLE usuarios ADD COLUMN bio VARCHAR(160);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'apelido'
      ) THEN
        ALTER TABLE usuarios ADD COLUMN apelido VARCHAR(40);
      END IF;
    END $$;
  `);
}

export async function down() {
  throw new Error(
    'Migração irreversível: colunas bio/apelido podem conter dados dos usuários.'
  );
}
