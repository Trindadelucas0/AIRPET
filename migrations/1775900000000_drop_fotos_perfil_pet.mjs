export const shorthands = undefined;

/**
 * Limpeza final do sistema de galeria solta.
 *
 * Esta migration completa o ciclo iniciado em
 * `1775800000000_migrar_galeria_em_posts.mjs`:
 *
 *  - Confirma que TODAS as linhas de `fotos_perfil_pet` ja foram migradas
 *    para `publicacoes` (coluna `migrated_post_id` preenchida).
 *  - Caso encontre alguma linha pendente, ela e migrada agora (defensivo).
 *  - DROPa a tabela `fotos_perfil_pet` e seus indices.
 *
 * Apos esta migration:
 *  - Toda foto de pet vive em `publicacoes` + `post_media`.
 *  - Endpoints `/perfil/galeria*` foram removidos (ver `routes/index.js`).
 *  - Modelo `FotoPerfilPet.js` foi removido.
 */
export async function up(pgm) {
  // Migra qualquer linha pendente que tenha sobrado (defensivo).
  pgm.sql(`
    DO $$
    DECLARE
      r RECORD;
      novo_id INTEGER;
      tabela_existe BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'fotos_perfil_pet'
      ) INTO tabela_existe;

      IF NOT tabela_existe THEN
        RETURN;
      END IF;

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
      END LOOP;
    END $$;
  `);

  // DROP da tabela e indices. CASCADE para garantir limpeza de FKs raras.
  pgm.sql(`DROP INDEX IF EXISTS idx_fotos_perfil_pet_usuario;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_fotos_perfil_pet_pet;`);
  pgm.sql(`DROP TABLE IF EXISTS fotos_perfil_pet CASCADE;`);
}

export async function down() {
  throw new Error(
    'Migracao irreversivel: dados ja foram colapsados em publicacoes + post_media.'
  );
}
