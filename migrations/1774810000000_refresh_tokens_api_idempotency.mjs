export const shorthands = undefined;

/**
 * Refresh tokens (app mobile / clientes sem cookie de sessão) e respostas idempotentes para PATCH /api/v1/me.
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      expira_em TIMESTAMPTZ NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revogado_em TIMESTAMPTZ,
      user_agent TEXT,
      CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash)
    );
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario_ativo
    ON refresh_tokens (usuario_id)
    WHERE revogado_em IS NULL;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS api_idempotency_responses (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      scope VARCHAR(64) NOT NULL,
      idempotency_key VARCHAR(128) NOT NULL,
      status_code INTEGER NOT NULL,
      body_json JSONB NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT api_idempotency_responses_unique UNIQUE (usuario_id, scope, idempotency_key)
    );
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_api_idempotency_criado_em ON api_idempotency_responses (criado_em);
  `);
}

export async function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS api_idempotency_responses;');
  pgm.sql('DROP TABLE IF EXISTS refresh_tokens;');
}
