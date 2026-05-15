export const shorthands = undefined;

/**
 * Lista de espera — wizard /lista-espera (fonte canônica).
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS lista_espera (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      telefone TEXT,
      cidade TEXT,
      estado CHAR(2),
      origem TEXT DEFAULT 'lista-espera-wizard',
      wizard_completo BOOLEAN DEFAULT TRUE,
      respostas JSONB,
      user_agent TEXT,
      ip_hash TEXT,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lista_espera_email ON lista_espera(email);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lista_espera_criado_em ON lista_espera(criado_em DESC);`);

  pgm.sql(`
    INSERT INTO lista_espera (
      nome, email, telefone, cidade, estado, origem, wizard_completo,
      respostas, user_agent, ip_hash, criado_em
    )
    SELECT
      COALESCE(NULLIF(TRIM(nome), ''), 'Sem nome'),
      LOWER(TRIM(email)),
      telefone,
      cidade,
      estado,
      COALESCE(NULLIF(TRIM(origem), ''), 'lista-espera-wizard'),
      COALESCE(wizard_completo, TRUE),
      respostas_json,
      user_agent,
      ip_hash,
      data_criacao
    FROM validacao_interesse
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ON CONFLICT (email) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_lista_espera_criado_em;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_lista_espera_email;`);
  pgm.sql(`DROP TABLE IF EXISTS lista_espera;`);
}
