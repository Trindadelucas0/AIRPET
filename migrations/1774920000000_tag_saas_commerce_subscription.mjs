export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS plan_definitions (
      id BIGSERIAL PRIMARY KEY,
      slug VARCHAR(50) NOT NULL UNIQUE,
      nome_exibicao VARCHAR(100) NOT NULL,
      mensalidade_centavos INTEGER NOT NULL DEFAULT 0,
      ordem INTEGER NOT NULL DEFAULT 0,
      ativo BOOLEAN NOT NULL DEFAULT true,
      features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data_atualizacao TIMESTAMPTZ
    );
  `);

  pgm.sql(`
    INSERT INTO plan_definitions (slug, nome_exibicao, mensalidade_centavos, ordem, ativo, features_json)
    VALUES
      ('basico', 'Basico', 1990, 1, true, '{"scan_publico_basico": true, "explorar_busca": true}'::jsonb),
      ('plus', 'Plus', 2990, 2, true, '{"scan_publico_basico": true, "scan_rico": true, "pet_perdido_mapa": true, "explorar_busca": true}'::jsonb),
      ('familia', 'Familia', 3990, 3, true, '{"scan_publico_basico": true, "scan_rico": true, "pet_perdido_mapa": true, "petshop_proximo": true, "notificacoes_multicanal": true, "explorar_busca": true}'::jsonb)
    ON CONFLICT (slug) DO NOTHING;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS tag_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      plan_slug VARCHAR(50) NOT NULL DEFAULT 'basico',
      status VARCHAR(30) NOT NULL DEFAULT 'ativa',
      valid_until TIMESTAMPTZ,
      grace_until TIMESTAMPTZ,
      last_transaction_nsu VARCHAR(100),
      data_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data_atualizacao TIMESTAMPTZ,
      UNIQUE (usuario_id)
    );
  `);
  pgm.sql(`
    ALTER TABLE tag_subscriptions
      ADD COLUMN IF NOT EXISTS plan_slug VARCHAR(50) NOT NULL DEFAULT 'basico',
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ativa',
      ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_transaction_nsu VARCHAR(100),
      ADD COLUMN IF NOT EXISTS data_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMPTZ;
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_valid_until ON tag_subscriptions (valid_until);`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS tag_product_orders (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      plan_slug VARCHAR(50) NOT NULL DEFAULT 'basico',
      order_type VARCHAR(30) NOT NULL DEFAULT 'compra_tag',
      status VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento',
      quantidade_tags INTEGER NOT NULL DEFAULT 0,
      subtotal_centavos INTEGER NOT NULL DEFAULT 0,
      desconto_centavos INTEGER NOT NULL DEFAULT 0,
      total_centavos INTEGER NOT NULL DEFAULT 0,
      promo_code VARCHAR(50),
      petshop_id INTEGER REFERENCES petshops(id) ON DELETE SET NULL,
      infinitepay_order_nsu VARCHAR(120),
      transaction_nsu VARCHAR(120),
      checkout_url TEXT,
      invoice_slug VARCHAR(160),
      snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      paid_at TIMESTAMPTZ,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data_atualizacao TIMESTAMPTZ
    );
  `);
  pgm.sql(`
    ALTER TABLE tag_product_orders
      ADD COLUMN IF NOT EXISTS plan_slug VARCHAR(50) NOT NULL DEFAULT 'basico',
      ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) NOT NULL DEFAULT 'compra_tag',
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento',
      ADD COLUMN IF NOT EXISTS quantidade_tags INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS subtotal_centavos INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS desconto_centavos INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_centavos INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS petshop_id INTEGER REFERENCES petshops(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS infinitepay_order_nsu VARCHAR(120),
      ADD COLUMN IF NOT EXISTS transaction_nsu VARCHAR(120),
      ADD COLUMN IF NOT EXISTS checkout_url TEXT,
      ADD COLUMN IF NOT EXISTS invoice_slug VARCHAR(160),
      ADD COLUMN IF NOT EXISTS snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMPTZ;
  `);
  pgm.sql(`CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_orders_order_nsu ON tag_product_orders (infinitepay_order_nsu) WHERE infinitepay_order_nsu IS NOT NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_tag_orders_usuario_status ON tag_product_orders (usuario_id, status, data_criacao DESC);`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS tag_order_units (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES tag_product_orders(id) ON DELETE CASCADE,
      sequencia INTEGER NOT NULL,
      pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
      nfc_tag_id INTEGER REFERENCES nfc_tags(id) ON DELETE SET NULL,
      print_photo_url TEXT,
      personalization_status VARCHAR(30) NOT NULL DEFAULT 'pendente',
      activated_at TIMESTAMPTZ,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data_atualizacao TIMESTAMPTZ,
      UNIQUE (order_id, sequencia)
    );
  `);
  pgm.sql(`
    ALTER TABLE tag_order_units
      ADD COLUMN IF NOT EXISTS pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS nfc_tag_id INTEGER REFERENCES nfc_tags(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS print_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS personalization_status VARCHAR(30) NOT NULL DEFAULT 'pendente',
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMPTZ;
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_tag_order_units_order ON tag_order_units (order_id, personalization_status);`);
  pgm.sql(`CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_order_units_nfc_tag ON tag_order_units (nfc_tag_id) WHERE nfc_tag_id IS NOT NULL;`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT REFERENCES tag_product_orders(id) ON DELETE SET NULL,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      provider VARCHAR(30) NOT NULL DEFAULT 'infinitepay',
      event_type VARCHAR(60) NOT NULL,
      order_nsu VARCHAR(120),
      transaction_nsu VARCHAR(120),
      status VARCHAR(30) NOT NULL DEFAULT 'received',
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_event_provider_tx_event ON payment_events (provider, transaction_nsu, event_type) WHERE transaction_nsu IS NOT NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events (order_nsu, data_criacao DESC);`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id BIGSERIAL PRIMARY KEY,
      codigo VARCHAR(40) NOT NULL UNIQUE,
      tipo VARCHAR(20) NOT NULL DEFAULT 'percentual',
      valor INTEGER NOT NULL DEFAULT 0,
      ativo BOOLEAN NOT NULL DEFAULT true,
      valid_from TIMESTAMPTZ,
      valid_until TIMESTAMPTZ,
      max_usos_global INTEGER,
      max_usos_por_usuario INTEGER,
      plan_slugs_permitidos TEXT[],
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS promo_code_redemptions (
      id BIGSERIAL PRIMARY KEY,
      promo_code_id BIGINT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      order_id BIGINT REFERENCES tag_product_orders(id) ON DELETE SET NULL,
      desconto_centavos INTEGER NOT NULL DEFAULT 0,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_code_redemptions (usuario_id, data_criacao DESC);`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS referrals (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      codigo VARCHAR(40) NOT NULL UNIQUE,
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS referral_credits (
      id BIGSERIAL PRIMARY KEY,
      referrer_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      referred_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      order_id BIGINT REFERENCES tag_product_orders(id) ON DELETE SET NULL,
      tipo_credito VARCHAR(20) NOT NULL DEFAULT 'valor',
      valor_centavos INTEGER NOT NULL DEFAULT 0,
      dias_credito INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (referrer_usuario_id, referred_usuario_id, order_id)
    );
  `);

  pgm.sql(`
    ALTER TABLE nfc_tags
      ADD COLUMN IF NOT EXISTS substituida_por_tag_id INTEGER REFERENCES nfc_tags(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS desativada_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS motivo_desativacao VARCHAR(40),
      ADD COLUMN IF NOT EXISTS display_photo_url TEXT;
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_nfc_tags_pet_status ON nfc_tags (pet_id, status);`);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_nfc_tags_pet_status;`);
  pgm.sql(`
    ALTER TABLE nfc_tags
      DROP COLUMN IF EXISTS display_photo_url,
      DROP COLUMN IF EXISTS motivo_desativacao,
      DROP COLUMN IF EXISTS desativada_em,
      DROP COLUMN IF EXISTS substituida_por_tag_id;
  `);

  pgm.sql(`DROP TABLE IF EXISTS referral_credits;`);
  pgm.sql(`DROP TABLE IF EXISTS referrals;`);
  pgm.sql(`DROP TABLE IF EXISTS promo_code_redemptions;`);
  pgm.sql(`DROP TABLE IF EXISTS promo_codes;`);
  pgm.sql(`DROP TABLE IF EXISTS payment_events;`);
  pgm.sql(`DROP TABLE IF EXISTS tag_order_units;`);
  pgm.sql(`DROP TABLE IF EXISTS tag_product_orders;`);
  pgm.sql(`DROP TABLE IF EXISTS tag_subscriptions;`);
  pgm.sql(`DROP TABLE IF EXISTS plan_definitions;`);
}
