export const shorthands = undefined;

/**
 * Remove a feature de grupos sociais (tabelas grupos / grupo_membros).
 * Rotas e UI foram retiradas do app; URLs antigas redirecionam em explorarRoutes.
 */
export async function up(pgm) {
  pgm.sql(`DROP TABLE IF EXISTS grupo_membros CASCADE;`);
  pgm.sql(`DROP TABLE IF EXISTS grupos CASCADE;`);
}

export async function down(pgm) {
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
}
