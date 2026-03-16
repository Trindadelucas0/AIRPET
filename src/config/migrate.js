/**
 * migrate.js — Auto-criacao de tabelas no boot do servidor
 *
 * Executado toda vez que o servidor inicia.
 * Verifica se as tabelas existem e cria as que faltam.
 * Usa CREATE TABLE IF NOT EXISTS para ser idempotente (seguro rodar varias vezes).
 * A ordem respeita foreign keys (tabelas referenciadas sao criadas primeiro).
 */

const path = require('path');
const fs = require('fs');
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
    data_hora_desaparecimento TIMESTAMP,
    cidade VARCHAR(100),
    data TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_pets_perdidos_loc ON pets_perdidos USING GIST (ultima_localizacao);`,

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
    ('horas_para_nivel3', '24', 'Horas sem encontrar para expandir para nivel 3')
  ON CONFLICT (chave) DO NOTHING;`,

  // Seeds de aparência / PWA (ícone, cores, nome do app)
  `INSERT INTO config_sistema (chave, valor, descricao) VALUES
    ('pwa_theme_color', '#ec5a1c', 'Cor do tema PWA e barra do navegador'),
    ('pwa_background_color', '#ffffff', 'Cor de fundo do PWA'),
    ('pwa_icon_192', '/images/icons/icon-192.png', 'URL do ícone 192x192'),
    ('pwa_icon_512', '/images/icons/icon-512.png', 'URL do ícone 512x512'),
    ('app_primary_color', '#ec5a1c', 'Cor principal do site (botões, links)'),
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

/**
 * Executa todas as migrations em sequencia.
 * Exige PostGIS antes; cada statement roda no pool — se uma falhar, as outras continuam.
 */
async function runMigrations() {
  await garantirPostGIS();

  const total = migrations.length;
  let erros = 0;

  logger.info('MIGRATE', `Verificando ${total} migrations...`);

  for (let i = 0; i < total; i++) {
    try {
      await pool.query(migrations[i]);
    } catch (err) {
      erros++;
      logger.error('MIGRATE', `Migration ${i + 1}/${total} falhou`, err);
    }
  }

  ['capa', 'perfil-galeria'].forEach((dir) => {
    try {
      const full = path.join(__dirname, '..', 'public', 'images', dir);
      fs.mkdirSync(full, { recursive: true });
    } catch (e) {}
  });

  const ok = total - erros;
  if (erros > 0) {
    logger.warn('MIGRATE', `Concluido: ${ok}/${total} OK, ${erros} erro(s)`);
  } else {
    logger.info('MIGRATE', `Todas as ${total} migrations executadas com sucesso`);
  }

  return { total, ok, erros };
}

module.exports = { runMigrations };
