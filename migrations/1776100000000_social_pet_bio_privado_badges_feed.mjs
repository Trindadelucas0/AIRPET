export const shorthands = undefined;

/**
 * Fase social pet-first (execução do plano AIRPET):
 * - pets.bio_pet, pets.privado
 * - user_badges: pet_id, contexto, expira_em (badges ligados ao pet / efêmeros)
 * - Catálogo extra de badges (além de pet_verificado já semeado em 177570)
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE pets ADD COLUMN IF NOT EXISTS bio_pet VARCHAR(160);
  `);
  pgm.sql(`
    ALTER TABLE pets ADD COLUMN IF NOT EXISTS privado BOOLEAN NOT NULL DEFAULT false;
  `);

  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_badges' AND column_name = 'pet_id'
      ) THEN
        ALTER TABLE user_badges ADD COLUMN pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_badges' AND column_name = 'contexto'
      ) THEN
        ALTER TABLE user_badges ADD COLUMN contexto VARCHAR(80);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_badges' AND column_name = 'expira_em'
      ) THEN
        ALTER TABLE user_badges ADD COLUMN expira_em TIMESTAMPTZ;
      END IF;
    END $$;
  `);

  pgm.sql(`
    INSERT INTO badges (code, name, description, icon)
    VALUES
      ('primeiro_post', 'Estreia', 'Primeira publicação no AIRPET.', 'fa-star'),
      ('posta_7_dias', 'Rotina', 'Postou em 7 dias seguidos.', 'fa-calendar-check'),
      ('pet_popular', 'Pet popular', 'Pet com 100+ seguidores.', 'fa-fire'),
      ('pet_em_alta', 'Em alta', 'Entre os pets com mais engajamento na sua região.', 'fa-bolt'),
      ('explorador', 'Explorador', 'Check-ins e descoberta no mapa.', 'fa-map-location-dot'),
      ('vencedor_desafio', 'Vencedor do desafio', 'Venceu um desafio semanal.', 'fa-trophy'),
      ('padrinho', 'Padrinho', 'Convidou amigos que publicaram.', 'fa-user-group'),
      ('pet_do_mes', 'Pet do mês', 'Venceu a votação mensal.', 'fa-crown')
    ON CONFLICT (code) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS bio_pet;`);
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS privado;`);
  pgm.sql(`
    ALTER TABLE user_badges DROP COLUMN IF EXISTS pet_id;
    ALTER TABLE user_badges DROP COLUMN IF EXISTS contexto;
    ALTER TABLE user_badges DROP COLUMN IF EXISTS expira_em;
  `);
  pgm.sql(`
    DELETE FROM user_badges
    WHERE badge_id IN (SELECT id FROM badges WHERE code IN (
      'primeiro_post','posta_7_dias','pet_popular','pet_em_alta',
      'explorador','vencedor_desafio','padrinho','pet_do_mes'
    ));
    DELETE FROM badges WHERE code IN (
      'primeiro_post','posta_7_dias','pet_popular','pet_em_alta',
      'explorador','vencedor_desafio','padrinho','pet_do_mes'
    );
  `);
}
