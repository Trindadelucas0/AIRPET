export const shorthands = undefined;

/**
 * Stories 24h, hashtags, desafios, check-ins no mapa, pet do mês, grupos (MVP),
 * desafio_id em publicacoes.
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS stories (
      id BIGSERIAL PRIMARY KEY,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      autor_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      media_url TEXT NOT NULL,
      media_type VARCHAR(10) NOT NULL DEFAULT 'image',
      legenda VARCHAR(280),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expira_em TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
      visivel BOOLEAN NOT NULL DEFAULT true,
      reportado BOOLEAN NOT NULL DEFAULT false
    );
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_stories_pet_expira
      ON stories (pet_id, expira_em DESC) WHERE visivel = true;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hashtags (
      id BIGSERIAL PRIMARY KEY,
      slug VARCHAR(50) UNIQUE NOT NULL,
      nome_exibicao VARCHAR(80) NOT NULL,
      uso_count BIGINT NOT NULL DEFAULT 0,
      ultima_atividade TIMESTAMPTZ,
      oficial BOOLEAN NOT NULL DEFAULT false,
      bloqueada BOOLEAN NOT NULL DEFAULT false,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_hashtags_uso ON hashtags (uso_count DESC) WHERE bloqueada = false;`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS post_hashtags (
      publicacao_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
      hashtag_id BIGINT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (publicacao_id, hashtag_id)
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_post_hashtags_tag ON post_hashtags (hashtag_id, criado_em DESC);`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hashtag_follows (
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      hashtag_id BIGINT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, hashtag_id)
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS desafios (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(60) UNIQUE NOT NULL,
      titulo VARCHAR(120) NOT NULL,
      descricao TEXT,
      hashtag VARCHAR(50) NOT NULL,
      inicia_em TIMESTAMPTZ NOT NULL,
      termina_em TIMESTAMPTZ NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'rascunho',
      capa_url TEXT,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS desafio_participacoes (
      id BIGSERIAL PRIMARY KEY,
      desafio_id INTEGER NOT NULL REFERENCES desafios(id) ON DELETE CASCADE,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      autor_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      publicacao_id INTEGER REFERENCES publicacoes(id) ON DELETE CASCADE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (desafio_id, pet_id)
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_desafio_part_desafio ON desafio_participacoes (desafio_id, criado_em DESC);`);

  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publicacoes' AND column_name = 'desafio_id'
      ) THEN
        ALTER TABLE publicacoes ADD COLUMN desafio_id INTEGER REFERENCES desafios(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS pet_checkins (
      id BIGSERIAL PRIMARY KEY,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      autor_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      publicacao_id INTEGER REFERENCES publicacoes(id) ON DELETE SET NULL,
      geo_point GEOGRAPHY(POINT, 4326) NOT NULL,
      precisao VARCHAR(20) NOT NULL DEFAULT 'bairro',
      local_nome VARCHAR(150),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pet_checkins_geo ON pet_checkins USING GIST (geo_point);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pet_checkins_pet ON pet_checkins (pet_id, criado_em DESC);`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS pet_do_mes_edicoes (
      id SERIAL PRIMARY KEY,
      mes_ref DATE NOT NULL UNIQUE,
      estado VARCHAR(20) NOT NULL DEFAULT 'aberta',
      vencedor_pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
      encerra_em TIMESTAMPTZ,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS pet_do_mes_votos (
      id BIGSERIAL PRIMARY KEY,
      edicao_id INTEGER NOT NULL REFERENCES pet_do_mes_edicoes(id) ON DELETE CASCADE,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (edicao_id, user_id)
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pdm_votos_pet ON pet_do_mes_votos (edicao_id, pet_id);`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS grupos (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(80) UNIQUE NOT NULL,
      nome VARCHAR(120) NOT NULL,
      descricao TEXT,
      tipo VARCHAR(20) NOT NULL DEFAULT 'tema',
      privacidade VARCHAR(20) NOT NULL DEFAULT 'aberto',
      criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      membros_count INTEGER NOT NULL DEFAULT 0,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS grupo_membros (
      grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      papel VARCHAR(20) NOT NULL DEFAULT 'membro',
      entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (grupo_id, user_id)
    );
  `);

  pgm.sql(`
    INSERT INTO desafios (slug, titulo, descricao, hashtag, inicia_em, termina_em, estado)
    VALUES (
      'pet-dormindo-airpet',
      'Poste seu pet dormindo',
      'Primeiro desafio oficial — use a hashtag #petdormindo na legenda.',
      'petdormindo',
      NOW() - INTERVAL '1 day',
      NOW() + INTERVAL '365 days',
      'ativo'
    )
    ON CONFLICT (slug) DO NOTHING;
  `);

  pgm.sql(`
    INSERT INTO pet_do_mes_edicoes (mes_ref, estado, encerra_em)
    VALUES (
      date_trunc('month', NOW()::date)::date,
      'aberta',
      (date_trunc('month', NOW()::date) + INTERVAL '1 month' - INTERVAL '1 second')
    )
    ON CONFLICT (mes_ref) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.sql(`ALTER TABLE publicacoes DROP COLUMN IF EXISTS desafio_id;`);
  pgm.sql(`DROP TABLE IF EXISTS grupo_membros CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS grupos CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS pet_do_mes_votos CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS pet_do_mes_edicoes CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS pet_checkins CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS desafio_participacoes CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS desafios CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS hashtag_follows CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS post_hashtags CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS hashtags CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS stories CASCADE;`);
}
