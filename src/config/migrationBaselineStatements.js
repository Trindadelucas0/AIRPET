/**
 * migrationBaselineStatements.js — SQL da baseline AIRPET
 *
 * Usado por node-pg-migrate (migrations/..._baseline.js).
 * Idempotente: CREATE IF NOT EXISTS / DO $$ com checks.
 */

const { pool } = require('./database');
const logger = require('../utils/logger');

const migrations = [
  // 1. Extensao PostGIS para queries geograficas
  `CREATE EXTENSION IF NOT EXISTS postgis;`,

  // 2. Usuarios — base de todo o sistema
  `CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'usuario',
    ultima_localizacao GEOGRAPHY(POINT, 4326),
    ultima_lat DECIMAL(10,7),
    ultima_lng DECIMAL(10,7),
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 3. Pets — vinculados a um usuario
  `CREATE TABLE IF NOT EXISTS pets (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    foto TEXT,
    descricao_emocional TEXT,
    raca VARCHAR(100),
    tipo VARCHAR(50) DEFAULT 'cachorro',
    peso DECIMAL(5,2),
    data_nascimento DATE,
    status VARCHAR(20) DEFAULT 'seguro',
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    petshop_vinculado_id INTEGER,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 4. Lotes de fabricacao de tags
  `CREATE TABLE IF NOT EXISTS tag_batches (
    id SERIAL PRIMARY KEY,
    codigo_lote VARCHAR(50) UNIQUE NOT NULL,
    quantidade INTEGER NOT NULL,
    fabricante VARCHAR(100),
    observacoes TEXT,
    criado_por INTEGER REFERENCES usuarios(id),
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 5. NFC Tags — lifecycle: stock -> reserved -> sent -> active -> blocked
  `CREATE TABLE IF NOT EXISTS nfc_tags (
    id SERIAL PRIMARY KEY,
    tag_code VARCHAR(20) UNIQUE NOT NULL,
    activation_code VARCHAR(20) NOT NULL,
    qr_code VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'stock',
    batch_id INTEGER REFERENCES tag_batches(id),
    user_id INTEGER REFERENCES usuarios(id),
    pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
    activated_at TIMESTAMP,
    sent_at TIMESTAMP,
    reserved_at TIMESTAMP,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 6. Log de scans — auditoria de todo scan (mesmo pre-ativacao)
  `CREATE TABLE IF NOT EXISTS tag_scans (
    id SERIAL PRIMARY KEY,
    tag_id INTEGER REFERENCES nfc_tags(id),
    tag_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    cidade VARCHAR(100),
    ip VARCHAR(45),
    user_agent TEXT,
    data TIMESTAMP DEFAULT NOW()
  );`,

  // TAG commerce (pedidos, assinatura, pagamentos, cupons e indicação)
  `CREATE TABLE IF NOT EXISTS plan_definitions (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    nome_exibicao VARCHAR(100) NOT NULL,
    mensalidade_centavos INTEGER NOT NULL DEFAULT 0,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_atualizacao TIMESTAMPTZ
  );`,
  `INSERT INTO plan_definitions (slug, nome_exibicao, mensalidade_centavos, ordem, ativo, features_json)
   VALUES
    ('basico', 'AIRPET Essencial', 1990, 1, true, '{"scan_publico_basico": true, "explorar_busca": true}'::jsonb),
    ('plus', 'AIRPET Protecao', 2990, 2, true, '{"scan_publico_basico": true, "scan_rico": true, "pet_perdido_mapa": true, "explorar_busca": true}'::jsonb),
    ('familia', 'AIRPET Rede', 3990, 3, true, '{"scan_publico_basico": true, "scan_rico": true, "pet_perdido_mapa": true, "petshop_proximo": true, "notificacoes_multicanal": true, "explorar_busca": true}'::jsonb)
   ON CONFLICT (slug) DO NOTHING;`,

  `CREATE TABLE IF NOT EXISTS tag_subscriptions (
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
  );`,
  `CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_valid_until ON tag_subscriptions (valid_until);`,

  `CREATE TABLE IF NOT EXISTS tag_product_orders (
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
    petshop_id INTEGER,
    infinitepay_order_nsu VARCHAR(120),
    transaction_nsu VARCHAR(120),
    checkout_url TEXT,
    invoice_slug VARCHAR(160),
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    paid_at TIMESTAMPTZ,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_atualizacao TIMESTAMPTZ
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_orders_order_nsu
   ON tag_product_orders (infinitepay_order_nsu)
   WHERE infinitepay_order_nsu IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_tag_orders_usuario_status
   ON tag_product_orders (usuario_id, status, data_criacao DESC);`,

  `CREATE TABLE IF NOT EXISTS tag_order_units (
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
  );`,
  `CREATE INDEX IF NOT EXISTS idx_tag_order_units_order
   ON tag_order_units (order_id, personalization_status);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_order_units_nfc_tag
   ON tag_order_units (nfc_tag_id)
   WHERE nfc_tag_id IS NOT NULL;`,
  `CREATE TABLE IF NOT EXISTS tag_product_order_events (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES tag_product_orders(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    actor_admin_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_tag_product_order_events_lookup
   ON tag_product_order_events (order_id, created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS payment_events (
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
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_event_provider_tx_event
   ON payment_events (provider, transaction_nsu, event_type)
   WHERE transaction_nsu IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_payment_events_order
   ON payment_events (order_nsu, data_criacao DESC);`,

  `CREATE TABLE IF NOT EXISTS promo_codes (
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
  );`,

  `CREATE TABLE IF NOT EXISTS promo_code_redemptions (
    id BIGSERIAL PRIMARY KEY,
    promo_code_id BIGINT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES tag_product_orders(id) ON DELETE SET NULL,
    desconto_centavos INTEGER NOT NULL DEFAULT 0,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user
   ON promo_code_redemptions (usuario_id, data_criacao DESC);`,

  `CREATE TABLE IF NOT EXISTS referrals (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS referral_credits (
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
  );`,

  // 7. Petshops — perfil completo estilo mini iFood
  `CREATE TABLE IF NOT EXISTS petshops (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    endereco TEXT,
    localizacao GEOGRAPHY(POINT, 4326),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    descricao TEXT,
    servicos TEXT[],
    horario_funcionamento JSONB,
    galeria_fotos TEXT[],
    ponto_de_apoio BOOLEAN DEFAULT false,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 8. Pontos do mapa — gerenciado pelo admin (vet, abrigo, hospital, etc)
  `CREATE TABLE IF NOT EXISTS pontos_mapa (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    endereco TEXT,
    localizacao GEOGRAPHY(POINT, 4326),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    descricao TEXT,
    servicos TEXT[],
    horario_funcionamento JSONB,
    galeria_fotos TEXT[],
    icone_mapa VARCHAR(50),
    ativo BOOLEAN DEFAULT true,
    criado_por INTEGER REFERENCES usuarios(id),
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // Indices espaciais para queries de bounding box (lazy loading do mapa)
  `CREATE INDEX IF NOT EXISTS idx_pontos_mapa_loc ON pontos_mapa USING GIST (localizacao);`,
  `CREATE INDEX IF NOT EXISTS idx_petshops_loc ON petshops USING GIST (localizacao);`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_tag_product_orders_petshop'
    ) THEN
      ALTER TABLE tag_product_orders
        ADD CONSTRAINT fk_tag_product_orders_petshop
        FOREIGN KEY (petshop_id) REFERENCES petshops(id) ON DELETE SET NULL;
    END IF;
  END $$;`,

  // 9. Pets perdidos — fluxo de aprovacao pelo admin
  `CREATE TABLE IF NOT EXISTS pets_perdidos (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    ultima_localizacao GEOGRAPHY(POINT, 4326),
    ultima_lat DECIMAL(10,7),
    ultima_lng DECIMAL(10,7),
    descricao TEXT,
    recompensa VARCHAR(50),
    status VARCHAR(30) DEFAULT 'pendente',
    nivel_alerta INTEGER DEFAULT 0,
    ciclo_alerta INTEGER NOT NULL DEFAULT 1,
    last_level_changed_at TIMESTAMPTZ,
    last_broadcast_at TIMESTAMPTZ,
    data_hora_desaparecimento TIMESTAMP,
    cidade VARCHAR(100),
    data TIMESTAMP DEFAULT NOW()
  );`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='pets_perdidos' AND column_name='ciclo_alerta'
    ) THEN
      ALTER TABLE pets_perdidos ADD COLUMN ciclo_alerta INTEGER NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='pets_perdidos' AND column_name='last_level_changed_at'
    ) THEN
      ALTER TABLE pets_perdidos ADD COLUMN last_level_changed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='pets_perdidos' AND column_name='last_broadcast_at'
    ) THEN
      ALTER TABLE pets_perdidos ADD COLUMN last_broadcast_at TIMESTAMPTZ;
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS pets_perdidos_alert_events (
    id BIGSERIAL PRIMARY KEY,
    pet_perdido_id INTEGER NOT NULL REFERENCES pets_perdidos(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    nivel_antes INTEGER,
    nivel_depois INTEGER,
    ciclo_alerta INTEGER NOT NULL DEFAULT 1,
    origem VARCHAR(30) NOT NULL DEFAULT 'sistema',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_pets_perdidos_alert_events_lookup
   ON pets_perdidos_alert_events (pet_perdido_id, created_at DESC);`,

  `CREATE INDEX IF NOT EXISTS idx_pets_perdidos_loc ON pets_perdidos USING GIST (ultima_localizacao);`,
  `CREATE INDEX IF NOT EXISTS idx_pets_perdidos_aprovado_data ON pets_perdidos (data ASC) WHERE status = 'aprovado';`,

  // 10. Localizacoes / avistamentos
  `CREATE TABLE IF NOT EXISTS localizacoes (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    ponto GEOGRAPHY(POINT, 4326),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    cidade VARCHAR(100),
    ip VARCHAR(45),
    foto_url TEXT,
    data TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_localizacoes_loc ON localizacoes USING GIST (ponto);`,

  // 11. Notificacoes
  `CREATE TABLE IF NOT EXISTS notificacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50),
    mensagem TEXT,
    link TEXT,
    lida BOOLEAN DEFAULT false,
    data TIMESTAMP DEFAULT NOW()
  );`,

  // 12. Agenda petshop
  `CREATE TABLE IF NOT EXISTS agenda_petshop (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER REFERENCES petshops(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    servico VARCHAR(100),
    data TIMESTAMP,
    status VARCHAR(30) DEFAULT 'agendado',
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 13. Chat — conversas
  `CREATE TABLE IF NOT EXISTS conversas (
    id SERIAL PRIMARY KEY,
    pet_perdido_id INTEGER REFERENCES pets_perdidos(id) ON DELETE CASCADE,
    encontrador_nome VARCHAR(100),
    encontrador_telefone VARCHAR(20),
    dono_id INTEGER REFERENCES usuarios(id),
    status VARCHAR(30) DEFAULT 'ativa',
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 14. Chat — mensagens (toda mensagem precisa de aprovacao do admin)
  `CREATE TABLE IF NOT EXISTS mensagens_chat (
    id SERIAL PRIMARY KEY,
    conversa_id INTEGER REFERENCES conversas(id) ON DELETE CASCADE,
    remetente VARCHAR(30) NOT NULL,
    tipo VARCHAR(20) DEFAULT 'texto',
    conteudo TEXT NOT NULL,
    foto_url TEXT,
    status_moderacao VARCHAR(30) DEFAULT 'pendente',
    moderado_por INTEGER REFERENCES usuarios(id),
    moderado_em TIMESTAMP,
    data TIMESTAMP DEFAULT NOW()
  );`,

  // 15. Carteira de saude — vacinas
  `CREATE TABLE IF NOT EXISTS vacinas (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    data_aplicacao DATE,
    data_proxima DATE,
    veterinario VARCHAR(100),
    observacoes TEXT,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 16. Carteira de saude — registros gerais
  `CREATE TABLE IF NOT EXISTS registros_saude (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    descricao TEXT,
    data_registro DATE,
    data_proxima DATE,
    valor_numerico DECIMAL(10,2),
    veterinario VARCHAR(100),
    observacoes TEXT,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 17. Configuracoes globais do sistema
  `CREATE TABLE IF NOT EXISTS config_sistema (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao TEXT,
    atualizado_em TIMESTAMP DEFAULT NOW()
  );`,

  // Seeds de configuracao padrao (niveis de alerta)
  `INSERT INTO config_sistema (chave, valor, descricao) VALUES
    ('raio_alerta_nivel1_km', '1', 'Nivel 1: raio inicial de notificacao em km'),
    ('raio_alerta_nivel2_km', '3', 'Nivel 2: raio expandido apos X horas sem encontrar'),
    ('raio_alerta_nivel3_km', '0', 'Nivel 3: 0 = cidade inteira'),
    ('horas_para_nivel2', '6', 'Horas sem encontrar para expandir para nivel 2'),
    ('horas_para_nivel3', '24', 'Horas sem encontrar para expandir para nivel 3'),
    ('alerta_cooldown_horas', '24', 'Horas sem renotificar o mesmo usuario no mesmo alerta'),
    ('cron_intervalo_alertas_min', '30', 'Intervalo em minutos do cron de escalacao de alertas')
  ON CONFLICT (chave) DO NOTHING;`,

  // Seeds de aparência / PWA (ícone, cores, nome do app)
  `INSERT INTO config_sistema (chave, valor, descricao) VALUES
    ('pwa_theme_color', '#f26020', 'Cor do tema PWA e barra do navegador'),
    ('pwa_background_color', '#ffffff', 'Cor de fundo do PWA'),
    ('pwa_icon_192', '/images/icons/icon-192.png', 'URL do ícone 192x192'),
    ('pwa_icon_512', '/images/icons/icon-512.png', 'URL do ícone 512x512'),
    ('app_primary_color', '#f26020', 'Cor principal do site (botões, links)'),
    ('app_primary_hover_color', '#ff7a3d', 'Cor de hover da primária'),
    ('app_accent_glow', 'rgba(242,96,32,0.12)', 'Glow da cor primária'),
    ('app_green_color', '#22c55e', 'Cor global de sucesso'),
    ('app_red_color', '#ef4444', 'Cor global de erro'),
    ('app_purple_color', '#a78bfa', 'Cor global roxa'),
    ('app_blue_color', '#60a5fa', 'Cor global azul'),
    ('app_yellow_color', '#facc15', 'Cor global amarela'),
    ('app_name', 'AIRPET', 'Nome curto do aplicativo')
  ON CONFLICT (chave) DO NOTHING;`,

  // FK diferida: pets -> petshops (criada apos petshops existir)
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_pets_petshop'
    ) THEN
      ALTER TABLE pets
        ADD CONSTRAINT fk_pets_petshop
        FOREIGN KEY (petshop_vinculado_id) REFERENCES petshops(id)
        ON DELETE SET NULL;
    END IF;
  END $$;`,

  // === MIGRATIONS INCREMENTAIS (colunas novas em tabelas existentes) ===

  // Novas colunas em pets para completar o cadastro
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='cor') THEN
      ALTER TABLE pets ADD COLUMN cor VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='porte') THEN
      ALTER TABLE pets ADD COLUMN porte VARCHAR(30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='sexo') THEN
      ALTER TABLE pets ADD COLUMN sexo VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='tipo_custom') THEN
      ALTER TABLE pets ADD COLUMN tipo_custom VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='telefone_contato') THEN
      ALTER TABLE pets ADD COLUMN telefone_contato VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='data_atualizacao') THEN
      ALTER TABLE pets ADD COLUMN data_atualizacao TIMESTAMP;
    END IF;
  END $$;`,

  // data_atualizacao em pontos_mapa
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pontos_mapa' AND column_name='data_atualizacao') THEN
      ALTER TABLE pontos_mapa ADD COLUMN data_atualizacao TIMESTAMP;
    END IF;
  END $$;`,

  // Cor de perfil e data_atualizacao no usuario
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='cor_perfil') THEN
      ALTER TABLE usuarios ADD COLUMN cor_perfil VARCHAR(7) DEFAULT '#ec5a1c';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='data_atualizacao') THEN
      ALTER TABLE usuarios ADD COLUMN data_atualizacao TIMESTAMP;
    END IF;
  END $$;`,

  // Tabela de racas para busca no cadastro de pets
  `CREATE TABLE IF NOT EXISTS racas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    popular BOOLEAN DEFAULT false
  );`,

  // Garante constraint UNIQUE (idempotente — ignora se ja existe)
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'racas_nome_tipo_key'
    ) THEN
      DELETE FROM racas WHERE id NOT IN (
        SELECT MIN(id) FROM racas GROUP BY nome, tipo
      );
      ALTER TABLE racas ADD CONSTRAINT racas_nome_tipo_key UNIQUE (nome, tipo);
    END IF;
  END $$;`,

  // ========================================================
  // SEED COMPLETO DE RACAS — Cachorros (todas as racas reconhecidas)
  // ========================================================
  `INSERT INTO racas (nome, tipo, popular) VALUES
    ('Vira-lata (SRD)', 'cachorro', true),
    ('Labrador Retriever', 'cachorro', true),
    ('Golden Retriever', 'cachorro', true),
    ('Pastor Alemao', 'cachorro', true),
    ('Bulldog Frances', 'cachorro', true),
    ('Bulldog Ingles', 'cachorro', true),
    ('Poodle', 'cachorro', true),
    ('Poodle Toy', 'cachorro', false),
    ('Rottweiler', 'cachorro', true),
    ('Yorkshire Terrier', 'cachorro', true),
    ('Shih Tzu', 'cachorro', true),
    ('Pinscher Miniatura', 'cachorro', true),
    ('Pit Bull', 'cachorro', true),
    ('American Staffordshire Terrier', 'cachorro', false),
    ('Husky Siberiano', 'cachorro', true),
    ('Dachshund (Salsicha)', 'cachorro', true),
    ('Border Collie', 'cachorro', true),
    ('Beagle', 'cachorro', true),
    ('Boxer', 'cachorro', true),
    ('Maltes', 'cachorro', true),
    ('Lhasa Apso', 'cachorro', true),
    ('Chow Chow', 'cachorro', true),
    ('Akita Inu', 'cachorro', true),
    ('Akita Americano', 'cachorro', false),
    ('Spitz Alemao (Lulu da Pomerania)', 'cachorro', true),
    ('Dobermann', 'cachorro', false),
    ('Dalmata', 'cachorro', false),
    ('Cocker Spaniel Ingles', 'cachorro', false),
    ('Cocker Spaniel Americano', 'cachorro', false),
    ('Cavalier King Charles Spaniel', 'cachorro', false),
    ('Schnauzer Miniatura', 'cachorro', false),
    ('Schnauzer Gigante', 'cachorro', false),
    ('Schnauzer Standard', 'cachorro', false),
    ('Shar-Pei', 'cachorro', false),
    ('Basset Hound', 'cachorro', false),
    ('Bichon Frise', 'cachorro', false),
    ('Bull Terrier', 'cachorro', false),
    ('Bull Terrier Miniatura', 'cachorro', false),
    ('Staffordshire Bull Terrier', 'cachorro', false),
    ('West Highland White Terrier', 'cachorro', false),
    ('Jack Russell Terrier', 'cachorro', false),
    ('Fox Terrier', 'cachorro', false),
    ('Scottish Terrier', 'cachorro', false),
    ('Airedale Terrier', 'cachorro', false),
    ('Cairn Terrier', 'cachorro', false),
    ('Boston Terrier', 'cachorro', false),
    ('Weimaraner', 'cachorro', false),
    ('Vizsla', 'cachorro', false),
    ('Pointer Ingles', 'cachorro', false),
    ('Setter Irlandes', 'cachorro', false),
    ('Setter Gordon', 'cachorro', false),
    ('Springer Spaniel Ingles', 'cachorro', false),
    ('Cane Corso', 'cachorro', false),
    ('Dogo Argentino', 'cachorro', false),
    ('Fila Brasileiro', 'cachorro', false),
    ('Mastiff Ingles', 'cachorro', false),
    ('Mastim Tibetano', 'cachorro', false),
    ('Bullmastiff', 'cachorro', false),
    ('Dogue Alemao (Gran Danes)', 'cachorro', false),
    ('Sao Bernardo', 'cachorro', false),
    ('Terra Nova (Newfoundland)', 'cachorro', false),
    ('Bernese Mountain Dog', 'cachorro', false),
    ('Pastor Belga Malinois', 'cachorro', false),
    ('Pastor Belga Tervuren', 'cachorro', false),
    ('Pastor Australiano', 'cachorro', false),
    ('Pastor de Shetland', 'cachorro', false),
    ('Pastor Branco Suico', 'cachorro', false),
    ('Collie Pelo Longo', 'cachorro', false),
    ('Collie Pelo Curto', 'cachorro', false),
    ('Old English Sheepdog (Bobtail)', 'cachorro', false),
    ('Welsh Corgi Pembroke', 'cachorro', false),
    ('Welsh Corgi Cardigan', 'cachorro', false),
    ('Samoieda', 'cachorro', false),
    ('Malamute do Alasca', 'cachorro', false),
    ('Shiba Inu', 'cachorro', false),
    ('Basenji', 'cachorro', false),
    ('Whippet', 'cachorro', false),
    ('Galgo (Greyhound)', 'cachorro', false),
    ('Galgo Italiano', 'cachorro', false),
    ('Afghan Hound', 'cachorro', false),
    ('Borzoi', 'cachorro', false),
    ('Bloodhound', 'cachorro', false),
    ('Rhodesian Ridgeback', 'cachorro', false),
    ('Papillon', 'cachorro', false),
    ('Chihuahua', 'cachorro', false),
    ('Chihuahua Pelo Longo', 'cachorro', false),
    ('Pequines', 'cachorro', false),
    ('Pug', 'cachorro', true),
    ('Spitz Japones', 'cachorro', false),
    ('Chinese Crested (Crestado Chines)', 'cachorro', false),
    ('Coton de Tulear', 'cachorro', false),
    ('Havanes', 'cachorro', false),
    ('Komondor', 'cachorro', false),
    ('Kuvasz', 'cachorro', false),
    ('Pastor do Caucaso', 'cachorro', false),
    ('Pastor da Asia Central', 'cachorro', false),
    ('Leao da Rodesia', 'cachorro', false),
    ('Flat-Coated Retriever', 'cachorro', false),
    ('Chesapeake Bay Retriever', 'cachorro', false),
    ('Nova Scotia Duck Tolling Retriever', 'cachorro', false),
    ('Curly-Coated Retriever', 'cachorro', false),
    ('Lagotto Romagnolo', 'cachorro', false),
    ('Braco Alemao Pelo Curto', 'cachorro', false),
    ('Braco Italiano', 'cachorro', false),
    ('Irish Wolfhound', 'cachorro', false),
    ('Deerhound', 'cachorro', false),
    ('Saluki', 'cachorro', false),
    ('Pharaoh Hound', 'cachorro', false),
    ('Canaan Dog', 'cachorro', false),
    ('Australian Cattle Dog', 'cachorro', false),
    ('Bouvier des Flandres', 'cachorro', false),
    ('Briard', 'cachorro', false),
    ('Leonberger', 'cachorro', false),
    ('Hovawart', 'cachorro', false),
    ('Eurasier', 'cachorro', false),
    ('Keeshond', 'cachorro', false),
    ('Schipperke', 'cachorro', false),
    ('Bedlington Terrier', 'cachorro', false),
    ('Kerry Blue Terrier', 'cachorro', false),
    ('Soft Coated Wheaten Terrier', 'cachorro', false),
    ('Norwich Terrier', 'cachorro', false),
    ('Norfolk Terrier', 'cachorro', false),
    ('Rat Terrier', 'cachorro', false),
    ('Parson Russell Terrier', 'cachorro', false),
    ('Silky Terrier', 'cachorro', false),
    ('Biewer Terrier', 'cachorro', false),
    ('Terrier Brasileiro (Fox Paulistinha)', 'cachorro', false),
    ('Xoloitzcuintli (Mexicano Pelado)', 'cachorro', false),
    ('Thai Ridgeback', 'cachorro', false),
    ('Boerboel', 'cachorro', false),
    ('Tosa Inu', 'cachorro', false),
    ('Presa Canario', 'cachorro', false)
  ON CONFLICT (nome, tipo) DO NOTHING;`,

  // ========================================================
  // SEED COMPLETO DE RACAS — Gatos
  // ========================================================
  `INSERT INTO racas (nome, tipo, popular) VALUES
    ('Vira-lata (SRD)', 'gato', true),
    ('Siames', 'gato', true),
    ('Persa', 'gato', true),
    ('Maine Coon', 'gato', true),
    ('Ragdoll', 'gato', true),
    ('Bengal', 'gato', true),
    ('British Shorthair', 'gato', true),
    ('British Longhair', 'gato', false),
    ('Sphynx', 'gato', true),
    ('Abissinio', 'gato', true),
    ('Angora Turco', 'gato', true),
    ('Scottish Fold', 'gato', false),
    ('Birmanês (Sagrado da Birmânia)', 'gato', false),
    ('Burmês', 'gato', false),
    ('Russian Blue (Azul Russo)', 'gato', false),
    ('Exotico Pelo Curto', 'gato', false),
    ('American Shorthair', 'gato', false),
    ('American Curl', 'gato', false),
    ('Chartreux', 'gato', false),
    ('Cornish Rex', 'gato', false),
    ('Devon Rex', 'gato', false),
    ('Havana Brown', 'gato', false),
    ('Manx', 'gato', false),
    ('Norwegian Forest Cat', 'gato', false),
    ('Ocicat', 'gato', false),
    ('Oriental Shorthair', 'gato', false),
    ('Savannah', 'gato', false),
    ('Selkirk Rex', 'gato', false),
    ('Somali', 'gato', false),
    ('Tonquines', 'gato', false),
    ('Turkish Van', 'gato', false),
    ('Bombay', 'gato', false),
    ('Snowshoe', 'gato', false),
    ('Himalaio', 'gato', false),
    ('Singapura', 'gato', false),
    ('Korat', 'gato', false),
    ('Munchkin', 'gato', false),
    ('LaPerm', 'gato', false),
    ('Toyger', 'gato', false),
    ('Pixiebob', 'gato', false),
    ('Egyptian Mau', 'gato', false),
    ('Balines', 'gato', false),
    ('Japanese Bobtail', 'gato', false),
    ('Peterbald', 'gato', false),
    ('Don Sphynx (Donskoy)', 'gato', false),
    ('Lykoi (Gato Lobisomem)', 'gato', false),
    ('Ragamuffin', 'gato', false),
    ('Nebelung', 'gato', false),
    ('Curl Americano', 'gato', false),
    ('Khao Manee', 'gato', false)
  ON CONFLICT (nome, tipo) DO NOTHING;`,

  // ========================================================
  // SEED COMPLETO DE RACAS — Passaros
  // ========================================================
  `INSERT INTO racas (nome, tipo, popular) VALUES
    ('Calopsita', 'passaro', true),
    ('Periquito Australiano', 'passaro', true),
    ('Papagaio Verdadeiro', 'passaro', true),
    ('Canario', 'passaro', true),
    ('Agapornis', 'passaro', true),
    ('Cacatua', 'passaro', true),
    ('Arara Azul', 'passaro', false),
    ('Arara Vermelha', 'passaro', false),
    ('Arara Caninde', 'passaro', false),
    ('Ring-neck (Periquito de Colar)', 'passaro', false),
    ('Rosela', 'passaro', false),
    ('Diamante de Gould', 'passaro', false),
    ('Mandarim (Zebra Finch)', 'passaro', false),
    ('Loris e Loriquito', 'passaro', false),
    ('Eclectus', 'passaro', false),
    ('Tucano', 'passaro', false),
    ('Curio', 'passaro', false),
    ('Coleiro', 'passaro', false),
    ('Trinca-ferro', 'passaro', false),
    ('Sabia', 'passaro', false),
    ('Maritaca', 'passaro', false),
    ('Periquito Green Cheek (Pyrrhura)', 'passaro', false),
    ('Jandaia', 'passaro', false),
    ('Codorna', 'passaro', false),
    ('Pombo Domestico', 'passaro', false),
    ('Galinha (Pet)', 'passaro', false),
    ('Pato (Pet)', 'passaro', false),
    ('Cisne', 'passaro', false),
    ('Gaviao (Falcoaria)', 'passaro', false),
    ('Coruja (Domesticada)', 'passaro', false)
  ON CONFLICT (nome, tipo) DO NOTHING;`,

  // ========================================================
  // SEED COMPLETO DE RACAS — Outros (roedores, répteis, peixes, etc)
  // ========================================================
  `INSERT INTO racas (nome, tipo, popular) VALUES
    ('Hamster Sirio', 'outro', true),
    ('Hamster Anao Russo', 'outro', true),
    ('Hamster Roborovski', 'outro', false),
    ('Hamster Chines', 'outro', false),
    ('Coelho Mini Lion', 'outro', true),
    ('Coelho Mini Rex', 'outro', false),
    ('Coelho Holland Lop', 'outro', false),
    ('Coelho Netherland Dwarf', 'outro', false),
    ('Coelho Angorá', 'outro', false),
    ('Coelho Rex', 'outro', false),
    ('Coelho Nova Zelandia', 'outro', false),
    ('Coelho Californiano', 'outro', false),
    ('Porquinho da India (Peruano)', 'outro', true),
    ('Porquinho da India (Abissinio)', 'outro', false),
    ('Porquinho da India (Americano)', 'outro', false),
    ('Porquinho da India (Texel)', 'outro', false),
    ('Porquinho da India (Skinny)', 'outro', false),
    ('Chinchila', 'outro', true),
    ('Degus', 'outro', false),
    ('Gerbil', 'outro', false),
    ('Rato Twister', 'outro', false),
    ('Camundongo (Pet)', 'outro', false),
    ('Esquilo da Mongolia', 'outro', false),
    ('Sugar Glider (Petauro)', 'outro', false),
    ('Ouriço Africano (Hedgehog)', 'outro', false),
    ('Mini Porco (Mini Pig)', 'outro', false),
    ('Furao (Ferret)', 'outro', true),
    ('Tartaruga Tigre-dagua', 'outro', true),
    ('Tartaruga Jabuti', 'outro', false),
    ('Tartaruga de Orelha Vermelha', 'outro', false),
    ('Tartaruga Cagado', 'outro', false),
    ('Iguana Verde', 'outro', true),
    ('Gecko Leopardo', 'outro', false),
    ('Gecko Crestado', 'outro', false),
    ('Dragao Barbudo (Pogona)', 'outro', false),
    ('Cameliao Velado', 'outro', false),
    ('Cameliao Pantera', 'outro', false),
    ('Corn Snake (Cobra do Milho)', 'outro', false),
    ('Ball Python (Piton Real)', 'outro', false),
    ('Jiboia', 'outro', false),
    ('Teiú', 'outro', false),
    ('Axolote', 'outro', false),
    ('Sapo Pacman', 'outro', false),
    ('Peixe Betta', 'outro', true),
    ('Peixe Kinguio (Goldfish)', 'outro', false),
    ('Peixe Neon', 'outro', false),
    ('Peixe Guppy', 'outro', false),
    ('Peixe Oscar', 'outro', false),
    ('Peixe Palhaço (Nemo)', 'outro', false),
    ('Peixe Disco', 'outro', false),
    ('Caranguejo Eremita', 'outro', false),
    ('Camarao Ornamental', 'outro', false)
  ON CONFLICT (nome, tipo) DO NOTHING;`,

  // Admin agora e gerenciado via .env (ADMIN_EMAIL / ADMIN_PASSWORD)
  // Nao ha necessidade de promover usuarios a admin no banco

  // 18. Push subscriptions — Web Push notifications do PWA
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_push_sub_endpoint ON push_subscriptions (endpoint);`,

  // 19. Publicacoes — feed social de fotos de pets
  `CREATE TABLE IF NOT EXISTS publicacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
    foto VARCHAR(500) NOT NULL,
    legenda TEXT,
    fixada BOOLEAN DEFAULT false,
    criado_em TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_publicacoes_usuario ON publicacoes (usuario_id);`,
  `CREATE INDEX IF NOT EXISTS idx_publicacoes_criado ON publicacoes (criado_em DESC);`,

  // 20. Curtidas
  `CREATE TABLE IF NOT EXISTS curtidas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    publicacao_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(usuario_id, publicacao_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_curtidas_pub ON curtidas (publicacao_id);`,

  // 21. Comentarios
  `CREATE TABLE IF NOT EXISTS comentarios (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    publicacao_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_comentarios_pub ON comentarios (publicacao_id);`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'comentarios' AND column_name = 'parent_id'
    ) THEN
      ALTER TABLE comentarios
        ADD COLUMN parent_id INTEGER REFERENCES comentarios(id) ON DELETE CASCADE;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS idx_comentarios_parent ON comentarios (parent_id);`,
  `CREATE INDEX IF NOT EXISTS idx_comentarios_pub_parent ON comentarios (publicacao_id, parent_id);`,

  // 22. Seguidores
  `CREATE TABLE IF NOT EXISTS seguidores (
    id SERIAL PRIMARY KEY,
    seguidor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    seguido_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(seguidor_id, seguido_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_seguidores_seguido ON seguidores (seguido_id);`,
  `CREATE INDEX IF NOT EXISTS idx_seguidores_seguidor ON seguidores (seguidor_id);`,

  // Bio do usuario para perfil social
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='bio') THEN
      ALTER TABLE usuarios ADD COLUMN bio VARCHAR(160);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='foto_perfil') THEN
      ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='apelido') THEN
      ALTER TABLE usuarios ADD COLUMN apelido VARCHAR(40);
    END IF;
  END $$;`,

  // Colunas extras para publicacoes: texto, repost, tipo
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publicacoes' AND column_name='texto') THEN
      ALTER TABLE publicacoes ADD COLUMN texto TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publicacoes' AND column_name='repost_id') THEN
      ALTER TABLE publicacoes ADD COLUMN repost_id INTEGER REFERENCES publicacoes(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='publicacoes' AND column_name='tipo') THEN
      ALTER TABLE publicacoes ADD COLUMN tipo VARCHAR(20) DEFAULT 'original';
    END IF;
    ALTER TABLE publicacoes ALTER COLUMN foto DROP NOT NULL;
  END $$;`,

  // 24. Reposts tracking
  `CREATE TABLE IF NOT EXISTS reposts (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    publicacao_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(usuario_id, publicacao_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_reposts_pub ON reposts (publicacao_id);`,

  // === SOCIAL V2: mídia, menções, marcações, idempotência e stats de post ===
  `CREATE TABLE IF NOT EXISTS post_media (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type VARCHAR(20) NOT NULL DEFAULT 'image',
    width INTEGER,
    height INTEGER,
    order_index INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ready',
    created_at TIMESTAMP DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media (post_id, order_index);`,

  `CREATE TABLE IF NOT EXISTS post_mentions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    author_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (post_id, mentioned_user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_post_mentions_mentioned ON post_mentions (mentioned_user_id, created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS comment_mentions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES comentarios(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    author_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (comment_id, mentioned_user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned ON comment_mentions (mentioned_user_id, created_at DESC);`,

  `CREATE TABLE IF NOT EXISTS post_tags (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    tagged_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tagged_by_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (post_id, tagged_user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_post_tags_tagged_user ON post_tags (tagged_user_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags (post_id, status);`,

  `CREATE TABLE IF NOT EXISTS post_stats (
    post_id INTEGER PRIMARY KEY REFERENCES publicacoes(id) ON DELETE CASCADE,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    repost_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  );`,
  `INSERT INTO post_stats (post_id, like_count, comment_count, repost_count, updated_at)
   SELECT p.id,
          COALESCE((SELECT COUNT(*) FROM curtidas c WHERE c.publicacao_id = p.id), 0),
          COALESCE((SELECT COUNT(*) FROM comentarios c WHERE c.publicacao_id = p.id), 0),
          COALESCE((SELECT COUNT(*) FROM reposts r WHERE r.publicacao_id = p.id), 0),
          NOW()
     FROM publicacoes p
   ON CONFLICT (post_id) DO NOTHING;`,

  `CREATE OR REPLACE FUNCTION fn_sync_post_stats() RETURNS trigger AS $$
  DECLARE
    target_post_id INTEGER;
  BEGIN
    target_post_id := COALESCE(NEW.publicacao_id, OLD.publicacao_id);
    IF target_post_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    -- Durante cascata de DELETE do post (publicacoes), triggers em curtidas/comentarios/reposts podem disparar
    -- quando o post_id do pai já não existe mais. Nesse cenário, evitar upsert em post_stats previne
    -- violação de chave estrangeira.
    IF NOT EXISTS (SELECT 1 FROM publicacoes WHERE id = target_post_id) THEN
      DELETE FROM post_stats WHERE post_id = target_post_id;
      RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO post_stats (post_id, like_count, comment_count, repost_count, updated_at)
    VALUES (
      target_post_id,
      COALESCE((SELECT COUNT(*) FROM curtidas WHERE publicacao_id = target_post_id), 0),
      COALESCE((SELECT COUNT(*) FROM comentarios WHERE publicacao_id = target_post_id), 0),
      COALESCE((SELECT COUNT(*) FROM reposts WHERE publicacao_id = target_post_id), 0),
      NOW()
    )
    ON CONFLICT (post_id) DO UPDATE SET
      like_count = EXCLUDED.like_count,
      comment_count = EXCLUDED.comment_count,
      repost_count = EXCLUDED.repost_count,
      updated_at = NOW();
    RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_sync_post_stats_curtidas ON curtidas;`,
  `CREATE TRIGGER trg_sync_post_stats_curtidas
    AFTER INSERT OR DELETE ON curtidas
    FOR EACH ROW EXECUTE FUNCTION fn_sync_post_stats();`,
  `DROP TRIGGER IF EXISTS trg_sync_post_stats_comentarios ON comentarios;`,
  `CREATE TRIGGER trg_sync_post_stats_comentarios
    AFTER INSERT OR DELETE ON comentarios
    FOR EACH ROW EXECUTE FUNCTION fn_sync_post_stats();`,
  `DROP TRIGGER IF EXISTS trg_sync_post_stats_reposts ON reposts;`,
  `CREATE TRIGGER trg_sync_post_stats_reposts
    AFTER INSERT OR DELETE ON reposts
    FOR EACH ROW EXECUTE FUNCTION fn_sync_post_stats();`,

  `CREATE TABLE IF NOT EXISTS post_idempotency_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(80),
    response_body JSONB,
    status_code INTEGER NOT NULL DEFAULT 200,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE (user_id, idempotency_key)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_post_idempotency_exp ON post_idempotency_keys (expires_at);`,

  // Colunas de controle de tentativas de ativacao em nfc_tags
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfc_tags' AND column_name='tentativas_ativacao') THEN
      ALTER TABLE nfc_tags ADD COLUMN tentativas_ativacao INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='nfc_tags' AND column_name='bloqueada_ate') THEN
      ALTER TABLE nfc_tags ADD COLUMN bloqueada_ate TIMESTAMP;
    END IF;
  END $$;`,

  // 26. Campos de endereco no perfil do usuario
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='endereco') THEN
      ALTER TABLE usuarios ADD COLUMN endereco VARCHAR(300);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='cidade') THEN
      ALTER TABLE usuarios ADD COLUMN cidade VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='estado') THEN
      ALTER TABLE usuarios ADD COLUMN estado VARCHAR(2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='cep') THEN
      ALTER TABLE usuarios ADD COLUMN cep VARCHAR(10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='bairro') THEN
      ALTER TABLE usuarios ADD COLUMN bairro VARCHAR(100);
    END IF;
  END $$;`,

  // data_nascimento e contato_extra no perfil do usuario
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='data_nascimento') THEN
      ALTER TABLE usuarios ADD COLUMN data_nascimento DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='contato_extra') THEN
      ALTER TABLE usuarios ADD COLUMN contato_extra VARCHAR(200);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='bloqueado') THEN
      ALTER TABLE usuarios ADD COLUMN bloqueado BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='foto_capa') THEN
      ALTER TABLE usuarios ADD COLUMN foto_capa TEXT;
    END IF;
  END $$;`,

  // Capa do perfil e galeria de fotos por pet no perfil do tutor
  `CREATE TABLE IF NOT EXISTS fotos_perfil_pet (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    foto TEXT NOT NULL,
    ordem INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_fotos_perfil_pet_usuario ON fotos_perfil_pet (usuario_id);`,
  `CREATE INDEX IF NOT EXISTS idx_fotos_perfil_pet_pet ON fotos_perfil_pet (pet_id);`,

  // Campos extras em pets: microchip, castrado, alergias, veterinario, observacoes
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='microchip') THEN
      ALTER TABLE pets ADD COLUMN microchip VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='castrado') THEN
      ALTER TABLE pets ADD COLUMN castrado BOOLEAN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='alergias_medicacoes') THEN
      ALTER TABLE pets ADD COLUMN alergias_medicacoes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='veterinario_nome') THEN
      ALTER TABLE pets ADD COLUMN veterinario_nome VARCHAR(150);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='veterinario_telefone') THEN
      ALTER TABLE pets ADD COLUMN veterinario_telefone VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='observacoes') THEN
      ALTER TABLE pets ADD COLUMN observacoes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='foto_capa') THEN
      ALTER TABLE pets ADD COLUMN foto_capa TEXT;
    END IF;
  END $$;`,

  // 27. Seguidores de pets
  `CREATE TABLE IF NOT EXISTS seguidores_pets (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(usuario_id, pet_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_seguidores_pets_pet ON seguidores_pets (pet_id);`,
  `CREATE INDEX IF NOT EXISTS idx_seguidores_pets_user ON seguidores_pets (usuario_id);`,

  // 28. Diario do Pet — registro diario de alimentacao, passeios, remedios, etc
  `CREATE TABLE IF NOT EXISTS diario_pet (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id),
    tipo VARCHAR(30) NOT NULL,
    descricao TEXT,
    valor_numerico DECIMAL(10,2),
    foto TEXT,
    data DATE DEFAULT CURRENT_DATE,
    hora TIME DEFAULT CURRENT_TIME,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // 29. Notificacoes sociais — remetente e referencia a publicacao
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificacoes' AND column_name='remetente_id') THEN
      ALTER TABLE notificacoes ADD COLUMN remetente_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificacoes' AND column_name='publicacao_id') THEN
      ALTER TABLE notificacoes ADD COLUMN publicacao_id INTEGER REFERENCES publicacoes(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificacoes' AND column_name='data_criacao') THEN
      ALTER TABLE notificacoes ADD COLUMN data_criacao TIMESTAMP DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificacoes' AND column_name='pet_id') THEN
      ALTER TABLE notificacoes ADD COLUMN pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL;
    END IF;
  END $$;`,

  `CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes (usuario_id, data_criacao DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_notificacoes_pet ON notificacoes (pet_id);`,
  `CREATE INDEX IF NOT EXISTS idx_notificacoes_remetente ON notificacoes (remetente_id);`,

  // Regioes para notificacao em massa (lugares salvos: nome + centro + raio)
  `CREATE TABLE IF NOT EXISTS regioes_notificacao (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    raio_km DECIMAL(6,2) NOT NULL,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,

  // Opt-in do usuario para alertas de pet perdido
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='receber_alertas_pet_perdido') THEN
      ALTER TABLE usuarios ADD COLUMN receber_alertas_pet_perdido BOOLEAN DEFAULT true;
    END IF;
  END $$;`,

  // Log de execucoes do cron (alertas, vacinas, etc.)
  `CREATE TABLE IF NOT EXISTS cron_execucoes (
    id SERIAL PRIMARY KEY,
    job VARCHAR(50) NOT NULL,
    iniciado_em TIMESTAMP DEFAULT NOW(),
    finalizado_em TIMESTAMP,
    status VARCHAR(20) DEFAULT 'em_andamento',
    alertas_escalados INTEGER DEFAULT 0,
    notificacoes_enviadas INTEGER DEFAULT 0,
    erro TEXT
  );`,

  // Conversas: colunas iniciador_id e tutor_id (esquema usado pelo chatController/Conversa.js)
  `ALTER TABLE conversas ADD COLUMN IF NOT EXISTS iniciador_id INTEGER REFERENCES usuarios(id);`,
  `ALTER TABLE conversas ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES usuarios(id);`,
  `UPDATE conversas SET tutor_id = dono_id WHERE tutor_id IS NULL AND dono_id IS NOT NULL;`,

  // === FEED INTELIGENTE: EVENTOS BRUTOS, AGREGAÇÕES, GAMIFICAÇÃO E ANALYTICS ===

  // Índice espacial em usuarios.ultima_localizacao para feeds regionais e proximidade
  `CREATE INDEX IF NOT EXISTS idx_usuarios_ultima_loc
     ON usuarios USING GIST (ultima_localizacao)
     WHERE ultima_localizacao IS NOT NULL;`,

  // Eventos brutos de interação em publicações (append-only)
  `CREATE TABLE IF NOT EXISTS post_interactions_raw (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    actor_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    event_type VARCHAR(30) NOT NULL, -- like, comment, share, save, repost, view
    watch_ms INTEGER,
    profile_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    city VARCHAR(100),
    geo_point GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
  );`,

  `CREATE INDEX IF NOT EXISTS idx_post_interactions_post ON post_interactions_raw (post_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_post_interactions_user ON post_interactions_raw (user_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_post_interactions_type ON post_interactions_raw (event_type, created_at DESC);`,

  // Visitas a perfil (para interesse social e gamificação)
  `CREATE TABLE IF NOT EXISTS profile_visits_raw (
    id BIGSERIAL PRIMARY KEY,
    visitor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    source VARCHAR(50), -- feed, search, suggestion, external
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_profile_visits_profile ON profile_visits_raw (profile_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_profile_visits_visitor ON profile_visits_raw (visitor_id, created_at DESC);`,

  // Eventos de follow/unfollow (para força de relacionamento e detecção de spikes)
  `CREATE TABLE IF NOT EXISTS follow_events_raw (
    id BIGSERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    followed_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL, -- follow, unfollow
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_follow_events_followed ON follow_events_raw (followed_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_follow_events_follower ON follow_events_raw (follower_id, created_at DESC);`,

  // Eventos de moderação e sinalização (para qualidade e risco)
  `CREATE TABLE IF NOT EXISTS moderation_events_raw (
    id BIGSERIAL PRIMARY KEY,
    reporter_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    target_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    post_id INTEGER REFERENCES publicacoes(id) ON DELETE SET NULL,
    comment_id INTEGER REFERENCES comentarios(id) ON DELETE SET NULL,
    reason VARCHAR(100),
    action VARCHAR(50), -- report, block, mute, warning, ban
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_moderation_events_target_user ON moderation_events_raw (target_user_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_moderation_events_post ON moderation_events_raw (post_id, created_at DESC);`,

  // Perfil de interesse do usuário por espécie/raça
  `CREATE TABLE IF NOT EXISTS user_interest_profile (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    species VARCHAR(50) NOT NULL,
    breed VARCHAR(100),
    interest_score NUMERIC(12,4) DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    watch_ms_sum BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, species, breed)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_user_interest_user ON user_interest_profile (user_id);`,

  // Agregado de engajamento por publicação (janelas móveis calculadas em worker)
  `CREATE TABLE IF NOT EXISTS post_engagement_agg (
    post_id INTEGER PRIMARY KEY REFERENCES publicacoes(id) ON DELETE CASCADE,
    likes_24h INTEGER DEFAULT 0,
    comments_24h INTEGER DEFAULT 0,
    shares_24h INTEGER DEFAULT 0,
    saves_24h INTEGER DEFAULT 0,
    reposts_24h INTEGER DEFAULT 0,
    engagement_score NUMERIC(12,4) DEFAULT 0,
    velocity_score NUMERIC(12,4) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_post_engagement_score ON post_engagement_agg (engagement_score DESC);`,

  // Força de relacionamento entre usuários (proximidade social)
  `CREATE TABLE IF NOT EXISTS user_relationship_strength (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    strength_score NUMERIC(12,4) DEFAULT 0,
    interactions_30d INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, target_user_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_user_rel_user ON user_relationship_strength (user_id, strength_score DESC);`,

  // Snapshot de score por publicação (componentes para debug/analytics)
  `CREATE TABLE IF NOT EXISTS post_score_snapshot (
    post_id INTEGER PRIMARY KEY REFERENCES publicacoes(id) ON DELETE CASCADE,
    interest_component NUMERIC(12,4) DEFAULT 0,
    engagement_component NUMERIC(12,4) DEFAULT 0,
    recency_component NUMERIC(12,4) DEFAULT 0,
    social_component NUMERIC(12,4) DEFAULT 0,
    location_component NUMERIC(12,4) DEFAULT 0,
    quality_component NUMERIC(12,4) DEFAULT 0,
    manual_boost NUMERIC(12,4) DEFAULT 0,
    final_score NUMERIC(14,4) DEFAULT 0,
    scored_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_post_score_final ON post_score_snapshot (final_score DESC);`,

  // Pool de candidatos para feed (pré-computado por coorte simples)
  `CREATE TABLE IF NOT EXISTS feed_candidate_pool (
    id BIGSERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    segment VARCHAR(100) NOT NULL, -- ex: city:PARACATU, species:dog
    base_score NUMERIC(12,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_feed_candidate_segment ON feed_candidate_pool (segment, base_score DESC);`,

  // Gamificação do usuário (XP, nível, score de criador)
  `CREATE TABLE IF NOT EXISTS user_gamification (
    user_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    xp_points BIGINT DEFAULT 0,
    creator_score NUMERIC(12,4) DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    profile_completeness_score NUMERIC(5,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Catálogo de badges
  `CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100)
  );`,

  // Badges conquistados por usuário
  `CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, badge_id)
  );`,

  // Boost manual aplicado por admin em usuário ou post
  `CREATE TABLE IF NOT EXISTS manual_boosts (
    id SERIAL PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL, -- user, post
    target_id INTEGER NOT NULL,
    boost_value NUMERIC(12,4) NOT NULL,
    reason TEXT,
    starts_at TIMESTAMP DEFAULT NOW(),
    ends_at TIMESTAMP,
    created_by_admin INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_manual_boosts_target ON manual_boosts (target_type, target_id);`,

  // Agregados diários para o painel admin
  `CREATE TABLE IF NOT EXISTS analytics_daily_agg (
    id BIGSERIAL PRIMARY KEY,
    day DATE NOT NULL,
    city VARCHAR(100),
    species VARCHAR(50),
    users_active INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    posts_created INTEGER DEFAULT 0,
    interactions_total INTEGER DEFAULT 0,
    reports_total INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (day, city, species)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_analytics_daily_day ON analytics_daily_agg (day);`,

  // Sinais de risco por usuário (para moderação proativa)
  `CREATE TABLE IF NOT EXISTS user_risk_signals (
    user_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    sudden_follower_growth_score NUMERIC(12,4) DEFAULT 0,
    spam_probability NUMERIC(5,4) DEFAULT 0,
    report_rate NUMERIC(5,4) DEFAULT 0,
    block_rate NUMERIC(5,4) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  );`,

  // Posts em alta por dia (para “Trending”)
  `CREATE TABLE IF NOT EXISTS post_trending_daily (
    id BIGSERIAL PRIMARY KEY,
    day DATE NOT NULL,
    post_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
    score NUMERIC(12,4) NOT NULL,
    rank INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (day, post_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_post_trending_day_score ON post_trending_daily (day, score DESC);`,

  // === PETSHOPS PARCEIROS (onboarding, conta própria, comercial e agenda) ===

  // Slug único e colunas de gestão no petshop
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='slug') THEN
      ALTER TABLE petshops ADD COLUMN slug VARCHAR(180);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='status_parceria') THEN
      ALTER TABLE petshops ADD COLUMN status_parceria VARCHAR(30) DEFAULT 'ativo';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='email_contato') THEN
      ALTER TABLE petshops ADD COLUMN email_contato VARCHAR(150);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='logo_url') THEN
      ALTER TABLE petshops ADD COLUMN logo_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='foto_capa_url') THEN
      ALTER TABLE petshops ADD COLUMN foto_capa_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='avaliacao_media') THEN
      ALTER TABLE petshops ADD COLUMN avaliacao_media NUMERIC(3,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='avaliacoes_count') THEN
      ALTER TABLE petshops ADD COLUMN avaliacoes_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshops' AND column_name='data_atualizacao') THEN
      ALTER TABLE petshops ADD COLUMN data_atualizacao TIMESTAMP;
    END IF;
  END $$;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_petshops_slug_uniq ON petshops (slug) WHERE slug IS NOT NULL;`,

  // Solicitação pública de parceria
  `CREATE TABLE IF NOT EXISTS petshop_partner_requests (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER REFERENCES petshops(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'pendente',
    empresa_nome VARCHAR(150) NOT NULL,
    empresa_documento VARCHAR(30),
    responsavel_nome VARCHAR(120) NOT NULL,
    responsavel_cargo VARCHAR(80),
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(150) NOT NULL,
    endereco TEXT NOT NULL,
    bairro VARCHAR(120),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(10),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    localizacao GEOGRAPHY(POINT, 4326),
    redes_sociais JSONB,
    servicos JSONB,
    horario_funcionamento JSONB,
    descricao TEXT,
    logo_url TEXT,
    fotos_urls TEXT[],
    motivo_rejeicao TEXT,
    observacoes_admin TEXT,
    analisado_por_email VARCHAR(150),
    analisado_em TIMESTAMP,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP
  );`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name='petshop_partner_requests' AND column_name='petshop_id'
     ) THEN
       ALTER TABLE petshop_partner_requests ADD COLUMN petshop_id INTEGER REFERENCES petshops(id) ON DELETE CASCADE;
     END IF;
   END$$;`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_partner_requests_status ON petshop_partner_requests (status, data_criacao DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_partner_requests_loc ON petshop_partner_requests USING GIST (localizacao);`,

  // Conta própria do petshop (login separado)
  `CREATE TABLE IF NOT EXISTS petshop_accounts (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'pendente_aprovacao',
    ultimo_login_em TIMESTAMP,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_accounts_petshop ON petshop_accounts (petshop_id);`,

  // Vínculo petshop_accounts -> usuarios (acesso híbrido: dono usa plataforma como tutor)
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='petshop_accounts' AND column_name='usuario_id') THEN
      ALTER TABLE petshop_accounts ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_accounts_usuario ON petshop_accounts (usuario_id) WHERE usuario_id IS NOT NULL;`,

  // Perfil estendido, mídias e trilha
  `CREATE TABLE IF NOT EXISTS petshop_profiles (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL UNIQUE REFERENCES petshops(id) ON DELETE CASCADE,
    slogan VARCHAR(180),
    descricao_curta VARCHAR(280),
    descricao_longa TEXT,
    instagram_url TEXT,
    facebook_url TEXT,
    website_url TEXT,
    whatsapp_publico VARCHAR(20),
    contato_link TEXT,
    aceita_agendamento BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS petshop_media (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    url TEXT NOT NULL,
    titulo VARCHAR(120),
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_media_petshop ON petshop_media (petshop_id, tipo, ordem);`,

  // Feed/comercial do parceiro
  `CREATE TABLE IF NOT EXISTS petshop_posts (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    criado_por_account_id INTEGER REFERENCES petshop_accounts(id) ON DELETE SET NULL,
    post_type VARCHAR(20) NOT NULL DEFAULT 'normal',
    approval_status VARCHAR(30) NOT NULL DEFAULT 'aprovado',
    titulo VARCHAR(150),
    texto TEXT,
    foto_url TEXT,
    ativo BOOLEAN DEFAULT true,
    publicado_em TIMESTAMP DEFAULT NOW(),
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_posts_feed ON petshop_posts (petshop_id, post_type, approval_status, publicado_em DESC);`,

  // Destaques (grade/explorar) para posts do petshop
  `ALTER TABLE petshop_posts ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false;`,
  `ALTER TABLE petshop_posts ADD COLUMN IF NOT EXISTS highlight_rank INTEGER DEFAULT 0;`,

  `CREATE TABLE IF NOT EXISTS petshop_products (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES petshop_posts(id) ON DELETE SET NULL,
    nome VARCHAR(150) NOT NULL,
    preco NUMERIC(10,2) NOT NULL DEFAULT 0,
    descricao TEXT,
    foto_url TEXT,
    contato_link TEXT,
    is_promocao BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_products_active ON petshop_products (petshop_id, is_active, data_criacao DESC);`,

  // Destaques (grade/explorar) para promoções/produtos do petshop
  `ALTER TABLE petshop_products ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false;`,
  `ALTER TABLE petshop_products ADD COLUMN IF NOT EXISTS highlight_rank INTEGER DEFAULT 0;`,

  // Vincular produto/oferta a um serviço específico do petshop (quando marcado como "Serviço" no painel)
  `ALTER TABLE petshop_products ADD COLUMN IF NOT EXISTS service_id INTEGER;`,

  // Garante no máximo 15 produtos ativos por petshop
  `CREATE OR REPLACE FUNCTION fn_petshop_products_limit() RETURNS trigger AS $$
  BEGIN
    IF NEW.is_active THEN
      IF (
        SELECT COUNT(*) FROM petshop_products
        WHERE petshop_id = NEW.petshop_id
          AND is_active = true
          AND (TG_OP = 'INSERT' OR id <> NEW.id)
      ) >= 15 THEN
        RAISE EXCEPTION 'Limite de 15 produtos ativos por petshop excedido';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;`,
  `DROP TRIGGER IF EXISTS trg_petshop_products_limit ON petshop_products;`,
  `CREATE TRIGGER trg_petshop_products_limit
    BEFORE INSERT OR UPDATE ON petshop_products
    FOR EACH ROW
    EXECUTE FUNCTION fn_petshop_products_limit();`,

  // Likes/Comments de publicações do petshop (posts e promoções)
  // Observação: como publicações vêm de duas tabelas distintas (petshop_posts e petshop_products),
  // aqui usamos (publication_type, publication_id) sem FK direta para manter o migration simples.
  `CREATE TABLE IF NOT EXISTS petshop_publication_likes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    publication_type VARCHAR(30) NOT NULL, -- 'petshop_post' | 'petshop_product'
    publication_id INTEGER NOT NULL,
    created_em TIMESTAMP DEFAULT NOW(),
    UNIQUE (usuario_id, publication_type, publication_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_publication_likes_pub ON petshop_publication_likes (publication_type, publication_id);`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_publication_likes_user ON petshop_publication_likes (usuario_id, publication_type, publication_id);`,

  `CREATE TABLE IF NOT EXISTS petshop_publication_comments (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    publication_type VARCHAR(30) NOT NULL, -- 'petshop_post' | 'petshop_product'
    publication_id INTEGER NOT NULL,
    texto TEXT NOT NULL,
    created_em TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_publication_comments_pub ON petshop_publication_comments (publication_type, publication_id, created_em DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_publication_comments_user ON petshop_publication_comments (usuario_id, created_em DESC);`,

  // Seguidores, avaliações e vínculo pet <-> petshop
  `CREATE TABLE IF NOT EXISTS petshop_followers (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    data_criacao TIMESTAMP DEFAULT NOW(),
    UNIQUE (petshop_id, usuario_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_followers_petshop ON petshop_followers (petshop_id);`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_followers_usuario ON petshop_followers (usuario_id);`,

  `CREATE TABLE IF NOT EXISTS petshop_reviews (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comentario TEXT,
    status VARCHAR(20) DEFAULT 'publicado',
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP,
    UNIQUE (petshop_id, usuario_id, pet_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_reviews_petshop ON petshop_reviews (petshop_id, data_criacao DESC);`,

  `CREATE TABLE IF NOT EXISTS pet_petshop_links (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    tipo_vinculo VARCHAR(30) DEFAULT 'cliente',
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP,
    UNIQUE (pet_id, petshop_id)
  );`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pet_petshop_links' AND column_name='is_principal') THEN
      ALTER TABLE pet_petshop_links ADD COLUMN is_principal BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pet_petshop_links' AND column_name='relevance_score') THEN
      ALTER TABLE pet_petshop_links ADD COLUMN relevance_score NUMERIC(10,2) DEFAULT 0;
    END IF;
  END $$;`,
  `CREATE INDEX IF NOT EXISTS idx_pet_petshop_links_petshop ON pet_petshop_links (petshop_id, ativo);`,
  `CREATE INDEX IF NOT EXISTS idx_pet_petshop_links_principal ON pet_petshop_links (pet_id, is_principal);`,
  `CREATE TABLE IF NOT EXISTS pet_petshop_link_requests (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    usuario_solicitante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mensagem TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by_petshop_account_id INTEGER REFERENCES petshop_accounts(id) ON DELETE SET NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_pet_petshop_link_requests_petshop ON pet_petshop_link_requests (petshop_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_pet_petshop_link_requests_pet ON pet_petshop_link_requests (pet_id, status, created_at DESC);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_pet_petshop_link_requests_pending
    ON pet_petshop_link_requests (pet_id, petshop_id)
    WHERE status = 'pendente';`,

  // Agenda profissional do petshop
  `CREATE TABLE IF NOT EXISTS petshop_services (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT,
    foto_url TEXT,
    duracao_minutos INTEGER NOT NULL DEFAULT 30,
    preco_base NUMERIC(10,2),
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW(),
    UNIQUE (petshop_id, nome)
  );`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='petshop_services' AND column_name='foto_url'
    ) THEN
      ALTER TABLE petshop_services ADD COLUMN foto_url TEXT;
    END IF;
  END $$;`,

  `CREATE TABLE IF NOT EXISTS petshop_schedule_rules (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    abre TIME NOT NULL,
    fecha TIME NOT NULL,
    intervalo_inicio TIME,
    intervalo_fim TIME,
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW(),
    UNIQUE (petshop_id, dia_semana)
  );`,

  `CREATE TABLE IF NOT EXISTS petshop_time_slots (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES petshop_services(id) ON DELETE SET NULL,
    slot_inicio TIMESTAMP NOT NULL,
    slot_fim TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'disponivel',
    data_criacao TIMESTAMP DEFAULT NOW(),
    UNIQUE (petshop_id, slot_inicio, slot_fim)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_time_slots_lookup ON petshop_time_slots (petshop_id, slot_inicio, status);`,

  `CREATE TABLE IF NOT EXISTS petshop_appointments (
    id SERIAL PRIMARY KEY,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES petshop_services(id) ON DELETE SET NULL,
    slot_id INTEGER REFERENCES petshop_time_slots(id) ON DELETE SET NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'pendente',
    observacoes TEXT,
    motivo_recusa TEXT,
    data_agendada TIMESTAMP NOT NULL,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_appointments_panel ON petshop_appointments (petshop_id, status, data_agendada);`,

  // Integração com pet perdido e NFC (auditoria de alertas enviados)
  `CREATE TABLE IF NOT EXISTS petshop_lost_pet_alerts (
    id SERIAL PRIMARY KEY,
    pet_perdido_id INTEGER NOT NULL REFERENCES pets_perdidos(id) ON DELETE CASCADE,
    petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
    distancia_metros NUMERIC(10,2),
    origem VARCHAR(30) DEFAULT 'aprovacao_admin',
    canal VARCHAR(30) DEFAULT 'sistema',
    status_envio VARCHAR(30) DEFAULT 'enviado',
    data_criacao TIMESTAMP DEFAULT NOW(),
    UNIQUE (pet_perdido_id, petshop_id, origem)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_petshop_lost_pet_alerts_lookup ON petshop_lost_pet_alerts (pet_perdido_id, data_criacao DESC);`,
];

/**
 * Verifica se a extensao PostGIS esta disponivel no PostgreSQL.
 * Sem PostGIS, o tipo geography nao existe e todas as tabelas com coordenadas falham.
 * @throws {Error} Se PostGIS nao estiver instalado no servidor
 */
async function garantirPostGIS() {
  const res = await pool.query(
    `SELECT name FROM pg_available_extensions WHERE name = 'postgis'`
  );
  if (!res.rows.length) {
    const msg =
      'A extensao PostGIS nao esta instalada no PostgreSQL. ' +
      'Instale no servidor (ex: Ubuntu/Debian: sudo apt install postgresql-16-postgis-3) ' +
      'e reinicie o PostgreSQL. Depois, no banco: CREATE EXTENSION postgis;';
    logger.error('MIGRATE', msg);
    throw new Error(msg);
  }
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  logger.info('MIGRATE', 'PostGIS disponivel');
}

module.exports = { migrations, garantirPostGIS };
