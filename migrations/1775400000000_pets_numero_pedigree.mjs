export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'numero_pedigree'
      ) THEN
        ALTER TABLE pets ADD COLUMN numero_pedigree VARCHAR(80);
      END IF;
    END $$;
  `);
}

export async function down() {
  throw new Error(
    'Migração irreversível: coluna numero_pedigree pode conter dados de identificação.'
  );
}
