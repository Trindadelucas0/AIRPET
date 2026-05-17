export const shorthands = undefined;

/**
 * Verificação de e-mail no cadastro.
 *
 * Antes, o template `accountConfirm.js` existia mas não estava ligado a nada
 * — qualquer typo no e-mail criava conta fantasma. Agora:
 *   - Ao se cadastrar, o usuário recebe e-mail com link `/auth/verificar-email/:token`.
 *   - A coluna `usuarios.email_verificado_em` marca quando confirmou.
 *   - A tabela `email_verifications` guarda o hash do token e a expiração.
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS email_verificado_em TIMESTAMPTZ;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL,
      expira_em TIMESTAMPTZ NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      usado_em TIMESTAMPTZ,
      CONSTRAINT email_verifications_hash_key UNIQUE (token_hash)
    );
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_email_verifications_usuario_ativo
    ON email_verifications (usuario_id)
    WHERE usado_em IS NULL;
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_email_verifications_expira
    ON email_verifications (expira_em);
  `);
}

export async function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS email_verifications;');
  pgm.sql('ALTER TABLE usuarios DROP COLUMN IF EXISTS email_verificado_em;');
}
