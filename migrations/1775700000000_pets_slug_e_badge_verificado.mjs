export const shorthands = undefined;

/**
 * Adiciona pets.slug (UNIQUE) para URLs publicas amigaveis (/p/:slug).
 * Faz backfill determinístico via funcao auxiliar e cria indice unico.
 *
 * Tambem semeia o badge "pet_verificado" no catalogo `badges` (ja existe a
 * tabela desde o baseline, mas sem seed) — usado quando o pet possui tag
 * NFC ativa e o tutor confirmou e-mail.
 */
export async function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'slug'
      ) THEN
        ALTER TABLE pets ADD COLUMN slug VARCHAR(80);
      END IF;
    END $$;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION airpet_slugify(input text) RETURNS text AS $$
    DECLARE
      s text;
    BEGIN
      IF input IS NULL THEN RETURN ''; END IF;
      s := lower(input);
      s := translate(
        s,
        'áàâãäåāăąçćčďđéèêëēėęěğíìîïīįĳľłñńňòóôõöøōőřśšşťţúùûüũūůűųýỳŷÿžźż',
        'aaaaaaaaaccccdeeeeeeeegiiiiiiijllnnnoooooooorsssttuuuuuuuuuyyyyzzz'
      );
      s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
      s := regexp_replace(s, '(^-+|-+$)', '', 'g');
      IF s = '' THEN s := 'pet'; END IF;
      RETURN substring(s from 1 for 60);
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);

  pgm.sql(`
    DO $$
    DECLARE
      r RECORD;
      base_slug text;
      candidate text;
      sufixo text;
    BEGIN
      FOR r IN SELECT id, nome FROM pets WHERE slug IS NULL OR slug = '' LOOP
        base_slug := airpet_slugify(coalesce(r.nome, 'pet'));
        sufixo := substring(md5(r.id::text || coalesce(r.nome,'')) from 1 for 6);
        candidate := base_slug || '-' || sufixo;
        WHILE EXISTS (SELECT 1 FROM pets WHERE slug = candidate AND id <> r.id) LOOP
          sufixo := substring(md5(random()::text || clock_timestamp()::text) from 1 for 6);
          candidate := base_slug || '-' || sufixo;
        END LOOP;
        UPDATE pets SET slug = candidate WHERE id = r.id;
      END LOOP;
    END $$;
  `);

  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_pets_slug_unique'
      ) THEN
        CREATE UNIQUE INDEX idx_pets_slug_unique ON pets (slug);
      END IF;
    END $$;
  `);

  pgm.sql(`
    INSERT INTO badges (code, name, description, icon)
    VALUES
      ('pet_verificado',
       'Pet Verificado AIRPET',
       'Atribuido quando o pet possui ao menos uma tag NFC ativa e o tutor confirmou e-mail. Sinaliza identidade real e prova de posse.',
       'fa-shield-halved')
    ON CONFLICT (code) DO NOTHING;
  `);
}

export async function down() {
  throw new Error(
    'Migracao irreversivel: pets.slug e seed de badge podem estar em uso em links publicos.'
  );
}
