export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE tag_product_orders
      ADD COLUMN IF NOT EXISTS billing_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS billing_cpf_cnpj VARCHAR(20),
      ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(30),
      ADD COLUMN IF NOT EXISTS billing_cep VARCHAR(12),
      ADD COLUMN IF NOT EXISTS billing_logradouro VARCHAR(160),
      ADD COLUMN IF NOT EXISTS billing_numero VARCHAR(20),
      ADD COLUMN IF NOT EXISTS billing_complemento VARCHAR(100),
      ADD COLUMN IF NOT EXISTS billing_bairro VARCHAR(100),
      ADD COLUMN IF NOT EXISTS billing_cidade VARCHAR(100),
      ADD COLUMN IF NOT EXISTS billing_uf VARCHAR(2),
      ADD COLUMN IF NOT EXISTS nfe_numero VARCHAR(40),
      ADD COLUMN IF NOT EXISTS nfe_chave VARCHAR(64),
      ADD COLUMN IF NOT EXISTS nfe_url_pdf TEXT,
      ADD COLUMN IF NOT EXISTS nfe_emitida_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS admin_nf_obs TEXT;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_tag_orders_billing_document
    ON tag_product_orders (billing_cpf_cnpj);
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_tag_orders_billing_document;`);
  pgm.sql(`
    ALTER TABLE tag_product_orders
      DROP COLUMN IF EXISTS admin_nf_obs,
      DROP COLUMN IF EXISTS nfe_emitida_em,
      DROP COLUMN IF EXISTS nfe_url_pdf,
      DROP COLUMN IF EXISTS nfe_chave,
      DROP COLUMN IF EXISTS nfe_numero,
      DROP COLUMN IF EXISTS billing_uf,
      DROP COLUMN IF EXISTS billing_cidade,
      DROP COLUMN IF EXISTS billing_bairro,
      DROP COLUMN IF EXISTS billing_complemento,
      DROP COLUMN IF EXISTS billing_numero,
      DROP COLUMN IF EXISTS billing_logradouro,
      DROP COLUMN IF EXISTS billing_cep,
      DROP COLUMN IF EXISTS billing_phone,
      DROP COLUMN IF EXISTS billing_cpf_cnpj,
      DROP COLUMN IF EXISTS billing_name;
  `);
}
