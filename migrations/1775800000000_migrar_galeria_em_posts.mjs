export const shorthands = undefined;

/**
 * Migra todas as fotos da galeria solta (`fotos_perfil_pet`) para o
 * sistema de posts (`publicacoes` + `post_media`), com `pet_id`
 * preenchido. A partir desta migracao, "toda foto e um post".
 *
 * Estrategia idempotente: adiciona coluna `fotos_perfil_pet.migrated_post_id`
 * para registrar a quem cada foto foi migrada; se for executada de novo,
 * pula as ja migradas.
 *
 * NAO deleta a tabela `fotos_perfil_pet` — isso fica para uma migracao
 * posterior (`limpeza_legado`) apos validar em producao.
 */
export async function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fotos_perfil_pet'
          AND column_name = 'migrated_post_id'
      ) THEN
        ALTER TABLE fotos_perfil_pet
          ADD COLUMN migrated_post_id INTEGER REFERENCES publicacoes(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  pgm.sql(`
    DO $$
    DECLARE
      r RECORD;
      novo_id INTEGER;
    BEGIN
      FOR r IN
        SELECT id, usuario_id, pet_id, foto, criado_em
        FROM fotos_perfil_pet
        WHERE migrated_post_id IS NULL
        ORDER BY criado_em ASC
      LOOP
        INSERT INTO publicacoes
          (usuario_id, pet_id, foto, legenda, texto, tipo, criado_em)
        VALUES
          (r.usuario_id, r.pet_id, r.foto, NULL, NULL, 'original', r.criado_em)
        RETURNING id INTO novo_id;

        INSERT INTO post_media (post_id, media_url, media_type, order_index, status)
        VALUES (novo_id, r.foto, 'image', 0, 'ready')
        ON CONFLICT DO NOTHING;

        UPDATE fotos_perfil_pet SET migrated_post_id = novo_id WHERE id = r.id;
      END LOOP;
    END $$;
  `);
}

export async function down() {
  throw new Error(
    'Migracao irreversivel: posts criados podem ter sido editados/curtidos/comentados.'
  );
}
