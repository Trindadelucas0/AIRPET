export const shorthands = undefined;

/**
 * Respostas aninhadas a comentários (thread estilo Twitter/Instagram).
 */
export async function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'comentarios' AND column_name = 'parent_id'
      ) THEN
        ALTER TABLE comentarios
          ADD COLUMN parent_id INTEGER REFERENCES comentarios(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_comentarios_parent ON comentarios (parent_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_comentarios_pub_parent ON comentarios (publicacao_id, parent_id);`);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_comentarios_pub_parent;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_comentarios_parent;`);
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'comentarios' AND column_name = 'parent_id'
      ) THEN
        ALTER TABLE comentarios DROP COLUMN parent_id;
      END IF;
    END $$;
  `);
}
