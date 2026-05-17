export const shorthands = undefined;

/**
 * Persiste tokens de recuperação de senha no banco.
 *
 * Antes desta tabela, os tokens viviam em um Map() em memória do processo —
 * reinício ou múltiplas instâncias quebravam o fluxo de "Esqueci minha senha".
 *
 * Guardamos apenas o hash (SHA-256) do token, nunca o valor cru, para reduzir
 * impacto em caso de dump do banco.
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      expira_em TIMESTAMPTZ NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      usado_em TIMESTAMPTZ,
      ip_origem VARCHAR(64),
      CONSTRAINT password_reset_tokens_hash_key UNIQUE (token_hash)
    );
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario_ativo
    ON password_reset_tokens (usuario_id)
    WHERE usado_em IS NULL;
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expira
    ON password_reset_tokens (expira_em);
  `);
}

export async function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS password_reset_tokens;');
}
