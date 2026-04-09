const { query } = require('../config/database');

let ensureSchemaPromise = null;

function isSchemaMissingError(err) {
  if (!err) return false;
  if (err.code === '42P01' || err.code === '42703') return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('does not exist')
    || msg.includes('não existe')
    || msg.includes('nao existe')
    || msg.includes('relation');
}

async function ensureTagCommerceSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await query(`
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
        )
      `);
      await query(`
        ALTER TABLE plan_definitions
          ADD COLUMN IF NOT EXISTS nome VARCHAR(100),
          ADD COLUMN IF NOT EXISTS descricao TEXT,
          ADD COLUMN IF NOT EXISTS preco INTEGER,
          ADD COLUMN IF NOT EXISTS beneficios JSONB NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS destaque BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      `);
      await query(`
        INSERT INTO plan_definitions (slug, nome_exibicao, mensalidade_centavos, ordem, ativo, features_json)
        VALUES
          ('basico', 'AIRPET Essencial', 1990, 1, true, '{"scan_publico_basico": true, "explorar_busca": true}'::jsonb),
          ('plus', 'AIRPET Protecao', 2990, 2, true, '{"scan_publico_basico": true, "scan_rico": true, "pet_perdido_mapa": true, "explorar_busca": true}'::jsonb),
          ('familia', 'AIRPET Rede', 3990, 3, true, '{"scan_publico_basico": true, "scan_rico": true, "pet_perdido_mapa": true, "petshop_proximo": true, "notificacoes_multicanal": true, "explorar_busca": true}'::jsonb)
        ON CONFLICT (slug) DO NOTHING
      `);
      await query(`
        UPDATE plan_definitions
        SET nome_exibicao = CASE slug
          WHEN 'basico' THEN 'AIRPET Essencial'
          WHEN 'plus' THEN 'AIRPET Protecao'
          WHEN 'familia' THEN 'AIRPET Rede'
          ELSE nome_exibicao
        END,
        data_atualizacao = NOW()
        WHERE slug IN ('basico', 'plus', 'familia')
      `);
      await query(`
        UPDATE plan_definitions
        SET
          nome = COALESCE(NULLIF(nome, ''), nome_exibicao),
          descricao = CASE
            WHEN slug = 'basico' THEN COALESCE(NULLIF(descricao, ''), 'Proteção fundamental para começar com segurança.')
            WHEN slug = 'plus' THEN COALESCE(NULLIF(descricao, ''), 'Plano recomendado com alertas e contexto de resgate.')
            WHEN slug = 'familia' THEN COALESCE(NULLIF(descricao, ''), 'Cobertura máxima com rede colaborativa e multicanal.')
            ELSE descricao
          END,
          preco = COALESCE(preco, mensalidade_centavos),
          beneficios = CASE
            WHEN jsonb_typeof(beneficios) = 'array' AND jsonb_array_length(beneficios) > 0 THEN beneficios
            WHEN slug = 'basico' THEN '["Contato rápido no scan","Página pública do pet","Notificação de escaneamento"]'::jsonb
            WHEN slug = 'plus' THEN '["Tudo do Essencial","Alerta com mapa","Notificações em tempo real"]'::jsonb
            WHEN slug = 'familia' THEN '["Tudo do Proteção","Rede colaborativa","Suporte prioritário"]'::jsonb
            ELSE '[]'::jsonb
          END,
          destaque = CASE
            WHEN slug = 'plus' THEN true
            ELSE COALESCE(destaque, false)
          END
      `);

      await query(`
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
        )
      `);
      await query(`
        ALTER TABLE tag_subscriptions
          ADD COLUMN IF NOT EXISTS plano_id BIGINT REFERENCES plan_definitions(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS status_assinatura VARCHAR(30) NOT NULL DEFAULT 'ativa',
          ADD COLUMN IF NOT EXISTS data_fim TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS renovacao_automatica BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS origem_pedido BIGINT,
          ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      `);
      await query(`
        UPDATE tag_subscriptions
        SET
          status_assinatura = COALESCE(NULLIF(status_assinatura, ''), status, 'ativa'),
          data_fim = COALESCE(data_fim, valid_until)
      `);
      await query(`
        UPDATE tag_subscriptions ts
        SET plano_id = pd.id
        FROM plan_definitions pd
        WHERE ts.plano_id IS NULL
          AND LOWER(COALESCE(ts.plan_slug, '')) = LOWER(pd.slug)
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_valid_until ON tag_subscriptions (valid_until)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_plan_id ON tag_subscriptions (plano_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_status_assinatura ON tag_subscriptions (status_assinatura)`);

      await query(`
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
          billing_name VARCHAR(150),
          billing_cpf_cnpj VARCHAR(20),
          billing_phone VARCHAR(30),
          billing_cep VARCHAR(12),
          billing_logradouro VARCHAR(160),
          billing_numero VARCHAR(20),
          billing_complemento VARCHAR(100),
          billing_bairro VARCHAR(100),
          billing_cidade VARCHAR(100),
          billing_uf VARCHAR(2),
          nfe_numero VARCHAR(40),
          nfe_chave VARCHAR(64),
          nfe_url_pdf TEXT,
          nfe_emitida_em TIMESTAMPTZ,
          admin_nf_obs TEXT,
          snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          paid_at TIMESTAMPTZ,
          data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          data_atualizacao TIMESTAMPTZ
        )
      `);
      await query(`
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
          ADD COLUMN IF NOT EXISTS admin_nf_obs TEXT
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_orders_order_nsu
        ON tag_product_orders (infinitepay_order_nsu)
        WHERE infinitepay_order_nsu IS NOT NULL
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tag_orders_usuario_status
        ON tag_product_orders (usuario_id, status, data_criacao DESC)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tag_orders_billing_document
        ON tag_product_orders (billing_cpf_cnpj)
      `);

      await query(`
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
        )
      `);
      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_tag_subscriptions_origem_pedido'
          ) THEN
            ALTER TABLE tag_subscriptions
            ADD CONSTRAINT fk_tag_subscriptions_origem_pedido
            FOREIGN KEY (origem_pedido)
            REFERENCES tag_product_orders(id)
            ON DELETE SET NULL;
          END IF;
        END $$;
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tag_order_units_order
        ON tag_order_units (order_id, personalization_status)
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_order_units_nfc_tag
        ON tag_order_units (nfc_tag_id)
        WHERE nfc_tag_id IS NOT NULL
      `);

      await query(`
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
        )
      `);
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_event_provider_tx_event
        ON payment_events (provider, transaction_nsu, event_type)
        WHERE transaction_nsu IS NOT NULL
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events (order_nsu, data_criacao DESC)`);

      await query(`
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
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS promo_code_redemptions (
          id BIGSERIAL PRIMARY KEY,
          promo_code_id BIGINT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          order_id BIGINT REFERENCES tag_product_orders(id) ON DELETE SET NULL,
          desconto_centavos INTEGER NOT NULL DEFAULT 0,
          data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user
        ON promo_code_redemptions (usuario_id, data_criacao DESC)
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS referrals (
          id BIGSERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          codigo VARCHAR(40) NOT NULL UNIQUE,
          data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await query(`
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
        )
      `);
    })().catch((err) => {
      ensureSchemaPromise = null;
      throw err;
    });
  }

  return ensureSchemaPromise;
}

module.exports = {
  ensureTagCommerceSchema,
  isSchemaMissingError,
};
