# AIRPET — Documentacao Completa do Sistema

## Indice

1. [O que e o AIRPET](#1-o-que-e-o-airpet)
2. [Como instalar e rodar](#2-como-instalar-e-rodar)
3. [Estrutura do projeto](#3-estrutura-do-projeto)
4. [Banco de dados](#4-banco-de-dados)
5. [Fluxos principais](#5-fluxos-principais)
6. [Todas as paginas e o que cada botao faz](#6-todas-as-paginas-e-o-que-cada-botao-faz)
7. [Painel do administrador](#7-painel-do-administrador)
8. [Sistema de tags NFC](#8-sistema-de-tags-nfc)
9. [Sistema de mapas](#9-sistema-de-mapas)
10. [Chat moderado](#10-chat-moderado)
11. [Sistema de notificacoes e push](#11-sistema-de-notificacoes-e-push)
12. [PWA — instalacao no celular](#12-pwa)
13. [Scheduler — jobs automaticos](#13-scheduler)
14. [Seguranca](#14-seguranca)
15. [API endpoints](#15-api-endpoints)
16. [Como integrar com outros sistemas](#16-como-integrar)
17. [Tecnologias usadas](#17-tecnologias-usadas)

---

## 1. O que e o AIRPET

O AIRPET e um sistema de **identificacao e recuperacao de pets** usando tags NFC.

**O conceito e simples:**
- Cada pet recebe uma tag NFC na coleira
- Se o pet se perder, qualquer pessoa que encontrar pode encostar o celular na tag
- Uma pagina abre automaticamente com a foto do pet, nome e botoes para contatar o dono
- O sistema salva a localizacao de quem escaneou, criando um rastro de avistamentos

**O sistema tambem oferece:**
- Rede de petshops parceiros (pontos de apoio)
- Mapa interativo com petshops, pets perdidos e avistamentos
- Carteira de saude digital (vacinas, consultas, exames) com lembretes automaticos
- Diario do pet (registro diario com fotos, anotacoes, peso)
- Chat moderado entre quem encontrou o pet e o dono
- Lista de conversas do usuario
- Notificacoes em tempo real + Web Push
- Escalamento automatico de alertas de pets perdidos (6h → nivel 2, 24h → nivel 3)
- Calendario de cuidados (proximas vacinas e consultas)
- Contador de idade do pet (anos/meses/dias + idade humana equivalente)
- Referencia de peso ideal por raca/porte
- Compartilhamento via WhatsApp (pet perdido)
- Pagina "Encontrei este pet" (via scan NFC)
- Pagina Explorar (mural da comunidade)
- Home dinamica com estatisticas e pets perdidos recentes
- Recuperacao de senha (esqueci minha senha)
- Dashboard administrativo completo
- Funciona como PWA (instala no celular como app)

---

## 2. Como instalar e rodar

### Pre-requisitos

1. **Node.js** (versao 18 ou superior) — [nodejs.org](https://nodejs.org)
2. **PostgreSQL** (versao 14 ou superior) com extensao **PostGIS**
3. **Git** (opcional, para clonar o repositorio)

### Passo a passo

**1. Instalar o PostgreSQL com PostGIS**

No Windows, baixe o instalador em [postgresql.org](https://www.postgresql.org/download/).
Durante a instalacao, selecione o "Stack Builder" e instale o PostGIS.

Depois, crie o banco de dados:
```sql
CREATE DATABASE airpet;
\c airpet
CREATE EXTENSION postgis;
```

**2. Configurar o arquivo .env**

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Preencha os valores:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha_do_postgres
DB_DATABASE=airpet

JWT_SECRET=cole_aqui_um_hash_aleatorio_longo
JWT_EXPIRES_IN=7d

SESSION_SECRET=cole_aqui_outro_hash_aleatorio_diferente

PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Admin do painel /admin (login separado)
ADMIN_EMAIL=admin@airpet.com
ADMIN_PASSWORD_HASH=$2b$12$... (hash bcrypt da senha)
# OU para desenvolvimento (menos seguro):
ADMIN_PASSWORD=sua_senha_admin

# Web Push (opcional — gere com: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:seu@email.com
```

Para gerar os secrets, rode no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Para gerar o hash da senha admin:
```bash
node -e "require('bcrypt').hash('sua_senha', 12).then(h => console.log(h))"
```

**3. Instalar dependencias**
```bash
npm install
```

**4. Compilar o CSS (TailwindCSS)**
```bash
npm run css:build
```Comando	Quando usar
npm run css:watch	Durante o desenvolvimento (recompila sozinho a cada mudança)
npm run css:build	Antes de colocar em produção (gera o CSS final minificado)
Sem rodar um desses comandos, o arquivo output.css não é gerado/atualizado e o visual do site não reflete as classes Tailwind que você usou nos templates.

**5. Iniciar o servidor**
```bash
npm run dev
```

O servidor vai:
1. Conectar no PostgreSQL
2. Criar todas as tabelas automaticamente (se nao existirem)
3. Iniciar os jobs automaticos (escalar alertas, lembretes de vacinas)
4. Iniciar em http://localhost:3000

### Criar o primeiro usuario admin

Cadastre-se normalmente em http://localhost:3000/auth/registro.
Depois, no banco de dados, mude o role para admin:
```sql
UPDATE usuarios SET role = 'admin' WHERE email = 'seu@email.com';
```

Ou use o painel admin separado em `/admin/login` (usa as credenciais do .env).

---

## 3. Estrutura do projeto

```
AIRPET/
  server.js              ← Ponto de entrada (inicia tudo)
  package.json           ← Dependencias e scripts
  .env                   ← Credenciais (NUNCA commitar)
  .env.example           ← Template do .env
  tailwind.config.js     ← Config do TailwindCSS
  
  src/
    config/
      database.js        ← Conexao com PostgreSQL (pool)
      session.js         ← Configuracao de sessoes
      migrate.js         ← Criacao automatica de tabelas
    
    controllers/         ← Recebem as requisicoes HTTP
      authController.js       → Login, registro, logout, esqueci senha, redefinir senha
      petController.js        → CRUD de pets, perfil com idade/peso ideal/calendario
      nfcController.js        → Scan NFC, encontrei pet, enviar foto
      tagController.js        → Ativacao e gestao de tags
      petshopController.js    → Listagem de petshops
      petPerdidoController.js → Reporte de pets perdidos
      localizacaoController.js → API de localizacao
      notificacaoController.js → Notificacoes do usuario
      agendaController.js     → Agendamentos (criar, listar, cancelar, confirmar)
      adminController.js      → Painel admin (dashboard, aprovar/rejeitar alertas,
                                  moderacao, escalar, CRUD usuarios, role)
      mapaController.js       → API de pins do mapa
      chatController.js       → Chat moderado + lista de conversas
      saudeController.js      → Carteira de saude (com ownership check)
      diarioController.js     → Diario do pet (com ownership check)
      pontoMapaController.js  → Gestao de pontos no mapa (usa model, sem query direta)
      perfilController.js     → Perfil do usuario (usa model, sem query direta)
    
    models/              ← Queries ao banco de dados
      Usuario.js              → +atualizarPerfil(), +atualizarRole()
      Pet.js                  → CRUD completo, atualizarStatus()
      NfcTag.js               → Ciclo de vida da tag
      TagBatch.js             → Lotes de fabricacao
      TagScan.js              → Auditoria de scans
      Petshop.js              → Listagem e busca
      PontoMapa.js            → CRUD completo (+deletar)
      PetPerdido.js           → +rejeitar(), aprovar, resolver, atualizarNivel
      Localizacao.js          → Registro e historico
      Notificacao.js          → Criar, listar, marcar lida, criar para multiplos
      AgendaPetshop.js        → +buscarPorId, +cancelar, +confirmar, +concluir
      Conversa.js             → +buscarPorUsuario() para lista de conversas
      MensagemChat.js         → CRUD + aprovar/rejeitar moderacao
      Vacina.js               → CRUD + buscarVencendo() para lembretes
      RegistroSaude.js        → CRUD completo
      DiarioPet.js            → CRUD de entradas do diario
      ConfigSistema.js        → Chave/valor de configuracoes
      PushSubscription.js     → Inscricoes Web Push
    
    routes/              ← Define URLs e conecta a controllers
      index.js                → Rota raiz, /termos, /privacidade, /explorar
      authRoutes.js           → Login, registro, esqueci-senha, redefinir-senha
      petRoutes.js            → CRUD pets (validacao no PUT tambem)
      nfcRoutes.js            → Scan, encontrei, enviar-foto (com multer)
      tagRoutes.js            → Ativacao, admin de tags
      petshopRoutes.js        → Listagem publica
      mapaRoutes.js           → API GeoJSON
      chatRoutes.js           → Lista conversas, mostrar conversa (autenticado)
      saudeRoutes.js          → Vacinas e registros
      diarioRoutes.js         → Diario (upload separado em /images/diario/)
      agendaRoutes.js         → Criar, listar, cancelar, confirmar
      petPerdidoRoutes.js     → Reportar, encontrado, resolver
      localizacaoRoutes.js    → API localizacao (protegida com auth)
      notificacaoRoutes.js    → Notificacoes do usuario
      adminRoutes.js          → Painel admin (login com bcrypt + rate limit)
    
    services/            ← Logica de negocio
      authService.js          → Hash de senha, JWT, login
      nfcService.js           → Decisao de tela ao escanear
      notificacaoService.js   → Criacao, envio, proximidade PostGIS
      pushService.js          → Web Push API (VAPID)
      schedulerService.js     → Jobs automaticos (escalar alertas, lembretes vacinas)
      localizacaoService.js   → Registro de localizacoes
      mapaService.js          → Queries PostGIS por bounding box
      chatService.js          → Moderacao de mensagens
      proximidadeService.js   → Busca de usuarios proximos (raio)
      saudeService.js         → Lembretes de vacinas
      petService.js           → Regras de pets
      tagService.js           → Geracao de codigos, ativacao 3 fatores
    
    middlewares/          ← Filtros que rodam antes dos controllers
      authMiddleware.js       → Verifica se esta logado (estaAutenticado)
      adminMiddleware.js      → Verifica se e admin (apenasAdmin)
      rateLimiter.js          → Limita requisicoes: geral, auth, login, ativacao
      validator.js            → Valida dados de formularios (validarPet, validarRegistro...)
    
    sockets/             ← WebSocket (tempo real)
      index.js                → Inicializa Socket.IO
      chatSocket.js           → Chat entre encontrador e dono
      notificacaoSocket.js    → Notificacoes em tempo real
    
    views/               ← Paginas HTML (EJS + TailwindCSS)
      home.ejs                → Landing dinamica (stats + pets perdidos)
      explorar.ejs            → Mural da comunidade (pets, petshops, recentes)
      termos.ejs              → Termos de uso
      privacidade.ejs         → Politica de privacidade (LGPD)
      perfil.ejs              → Perfil do usuario
      auth/
        login.ejs             → Login
        registro.ejs          → Registro
        esqueci-senha.ejs     → Formulario de recuperacao
        redefinir-senha.ejs   → Formulario de nova senha (com token)
      pets/
        meus-pets.ejs         → Grid de pets do usuario
        cadastro.ejs          → Wizard de cadastro
        perfil.ejs            → Perfil do pet (idade, peso ideal, calendario)
        editar.ejs            → Edicao do pet
        saude.ejs             → Carteira de saude
        confirmacao.ejs       → Confirmacao pos-cadastro
      nfc/
        nao-ativada.ejs       → Tag ainda nao vendida
        ativar.ejs            → Formulario de ativacao (3 fatores)
        intermediaria.ejs     → Tela principal quando alguem encontra o pet
        escolher-pet.ejs      → Escolher pet para tag
        encontrei.ejs         → Formulario "encontrei este pet"
        enviar-foto.ejs       → Upload de foto do pet encontrado
        encontrei-sucesso.ejs → Confirmacao pos-envio
      chat/
        lista.ejs             → Lista de conversas do usuario
        conversa.ejs          → Tela de chat
      diario/
        index.ejs             → Diario do pet
      mapa/
        index.ejs             → Mapa interativo
      petshops/
        lista.ejs             → Lista de petshops
        detalhes.ejs          → Detalhes do petshop
      pontos/
        detalhes.ejs          → Detalhes de ponto no mapa
      admin/
        login.ejs             → Login admin separado
        dashboard.ejs         → Dashboard com metricas
        usuarios.ejs          → Gerenciar usuarios (+alterar role)
        pets.ejs              → Gerenciar pets
        petshops.ejs          → Gerenciar petshops
        pets-perdidos.ejs     → Aprovar/rejeitar/escalar alertas
        moderacao.ejs         → Moderar mensagens do chat
        configuracoes.ejs     → Configuracoes do sistema
        gerenciar-mapa.ejs    → CRUD de pontos no mapa
        mapa.ejs              → Mapa administrativo
        tags.ejs              → Gerenciar tags NFC
        gerar-tags.ejs        → Gerar lote de tags
        lotes.ejs             → Historico de lotes
      partials/
        header.ejs            → Head HTML + meta tags
        nav.ejs               → Barra de navegacao (com link Explorar)
        footer.ejs            → Rodape
        flash.ejs             → Mensagens de sucesso/erro
        erro.ejs              → Pagina de erro generica
      layouts/
        main.ejs              → Layout principal
    
    public/              ← Arquivos estaticos
      css/output.css          → CSS compilado
      images/
        pets/               → Fotos de perfil dos pets
        diario/             → Fotos do diario (separado dos pets)
        chat/               → Fotos do chat
        icons/              → Icones PWA (192px, 512px)
      js/
        app.js              → Logica geral + compartilharWhatsApp()
        mapa.js             → Interacao com Leaflet + lazy loading
        pwa.js              → Registro do Service Worker + push
        permissions.js      → Modals de permissao (camera, GPS, notificacao)
      manifest.json           → Configuracao PWA
      sw.js                   → Service Worker (cache offline)
      offline.html            → Pagina offline
    
    utils/               ← Funcoes auxiliares
      helpers.js              → Geracao de codigos, formatacao
      logger.js               → Sistema de log com timestamp
      geolocation.js          → Helpers PostGIS
      upload.js               → Configuracao centralizada do multer
```

### Como o codigo se conecta (MVC)

```
Usuario clica em algo no navegador
        ↓
    ROTA (routes/) define qual controller chamar
        ↓
    MIDDLEWARE (middlewares/) verifica auth, rate limit, validacao
        ↓
    CONTROLLER (controllers/) recebe a requisicao
        ↓
    SERVICE (services/) executa a logica de negocio
        ↓
    MODEL (models/) faz a query no banco de dados
        ↓
    CONTROLLER recebe o resultado
        ↓
    VIEW (views/) renderiza a pagina HTML
        ↓
    Pagina aparece pro usuario
```

---

## 4. Banco de dados

O sistema usa **19 tabelas** no PostgreSQL com extensao PostGIS (para dados geograficos).

### Tabelas e o que guardam

| Tabela | O que guarda | Campos principais |
|--------|-------------|-------------------|
| **usuarios** | Donos de pets e admins | nome, email, senha_hash, role, cor_perfil, ultima_localizacao, ultima_lat/lng |
| **pets** | Os animais cadastrados | nome, foto, descricao_emocional, raca, tipo, peso, status, data_nascimento |
| **tag_batches** | Lotes de tags fabricadas | codigo_lote, quantidade, fabricante |
| **nfc_tags** | Tags NFC individuais | tag_code, activation_code, status, user_id, pet_id, qr_code |
| **tag_scans** | Log de todo scan NFC | tag_code, latitude, longitude, cidade, ip, user_agent |
| **petshops** | Petshops parceiros | nome, endereco, lat/lng, servicos, horario, galeria |
| **pontos_mapa** | Pontos no mapa (vet, abrigo...) | nome, categoria, lat/lng, telefone, whatsapp, servicos |
| **pets_perdidos** | Alertas de desaparecimento | pet_id, ultima_localizacao, status, nivel_alerta, recompensa, cidade |
| **localizacoes** | Avistamentos de pets | pet_id, lat/lng, ponto (geography), cidade, ip, origem |
| **notificacoes** | Alertas para usuarios | usuario_id, tipo, mensagem, lida, link |
| **agenda_petshop** | Agendamentos de servicos | petshop_id, pet_id, usuario_id, servico, data, status |
| **conversas** | Sessoes de chat | pet_perdido_id, iniciador_id, tutor_id, status |
| **mensagens_chat** | Mensagens do chat | conversa_id, remetente, conteudo, tipo, status_moderacao, moderado_por |
| **vacinas** | Carteira de vacinacao | pet_id, nome_vacina, data_aplicacao, data_proxima, veterinario, clinica |
| **registros_saude** | Consultas, exames, etc. | pet_id, tipo, descricao, data_registro, veterinario, clinica |
| **diario_pet** | Diario diario do pet | pet_id, usuario_id, tipo, descricao, valor_numerico, foto |
| **config_sistema** | Configuracoes globais | chave, valor (ex: raio_alerta_nivel1_km = 1) |
| **push_subscriptions** | Inscricoes Web Push | usuario_id, endpoint, keys_p256dh, keys_auth |
| **racas** | Catalogo de racas | nome, tipo (cachorro/gato), popular |
| **user_sessions** | Sessoes ativas (automatica) | sid, sess, expire |

### Status possiveis

| Tabela | Campo | Valores |
|--------|-------|---------|
| nfc_tags | status | stock, reserved, sent, active, blocked |
| pets_perdidos | status | pendente, aprovado, rejeitado, resolvido |
| pets_perdidos | nivel_alerta | 1, 2, 3 |
| agenda_petshop | status | agendado, confirmado, cancelado, concluido |
| mensagens_chat | status_moderacao | pendente, aprovada, rejeitada |
| conversas | status | ativa, encerrada |
| pets | status | seguro, perdido |

### As tabelas sao criadas automaticamente

Toda vez que o servidor inicia, o arquivo `src/config/migrate.js` verifica se cada tabela existe. Se nao existir, cria. Voce nunca precisa rodar SQL manualmente.

---

## 5. Fluxos principais

### 5.1 Fluxo do scan NFC (o mais importante do sistema)

```
Alguem encontra um pet com tag NFC
        ↓
Encosta o celular na tag
        ↓
Celular abre: http://seusite.com/tag/PET-82KJ91
        ↓
Sistema verifica o status da tag:

  ┌─ manufactured   → Pagina "Tag nao ativada"
  ├─ sent/reserved  → Pagina "Ativar sua tag" (para o comprador)
  ├─ active         → Pagina "PET ENCONTRADO" (para quem encontrou)
  └─ blocked        → Pagina "Tag bloqueada"

Se a tag esta ATIVA:
  1. Sistema salva automaticamente: quem escaneou, onde, quando, IP
  2. Notifica o dono: "Alguem escaneou a tag do Thor!"
  3. Mostra a pagina intermediaria com botoes de acao:
     - Ligar para o dono
     - Enviar localizacao
     - "Encontrei este pet" (formulario com nome, telefone, mensagem, foto)
     - "Enviar foto" (upload direto)
     - Conversar com o dono (chat moderado, se pet perdido)
```

### 5.2 Fluxo de ativacao da tag (3 fatores)

```
Cliente compra a tag → recebe uma caixa com:
  - Tag NFC fisica
  - Codigo de ativacao impresso (ex: AX9P-72KQ)

Para ativar, precisa dos 3 ao mesmo tempo:
  1. Tag fisica (encostar no celular → abre a URL)
  2. Estar logado na conta (prova que e o dono)
  3. Digitar o codigo da caixa (prova que recebeu o produto)

Se faltar qualquer um → nao ativa.
```

### 5.3 Fluxo de pet perdido (com escalamento automatico)

```
Dono marca pet como perdido (formulario com descricao, localizacao, recompensa)
        ↓
Status: PENDENTE (vai pro admin)
        ↓
Admin analisa e APROVA ou REJEITA
        ↓

Se APROVADO:
  Status: APROVADO, nivel_alerta = 1
        ↓
  Sistema notifica usuarios proximos (nivel 1: raio 1km via PostGIS)
        ↓
  [AUTOMATICO] Se ninguem encontrar em 6h → nivel 2: raio 3km
        ↓
  [AUTOMATICO] Se ninguem encontrar em 24h → nivel 3: cidade inteira
        ↓
  A cada escalamento, novas notificacoes sao disparadas
        ↓
  Alguem encontra e escaneia a tag
        ↓
  Pet aparece como "PERDIDO" com botoes extras:
    - Chat moderado com o dono
    - Enviar foto
    - Formulario "encontrei"
    - Banner de recompensa (se configurado)
        ↓
  Dono marca como resolvido → status: RESOLVIDO

Se REJEITADO:
  Dono e notificado: "Alerta rejeitado, verifique os dados"
  Pode tentar novamente
```

### 5.4 Fluxo do chat moderado

```
Quem encontrou o pet → clica "Conversar"
        ↓
Envia mensagem ou foto
        ↓
Mensagem fica PENDENTE (nao chega ao dono ainda)
        ↓
Admin ve a mensagem no painel de moderacao
        ↓
Admin APROVA → mensagem entregue ao dono em tempo real (Socket.IO + push)
   ou
Admin REJEITA → mensagem nao entregue
```

### 5.5 Fluxo de recuperacao de senha

```
Usuario clica "Esqueci minha senha" no login
        ↓
Digita o email cadastrado
        ↓
Sistema gera um token unico (expira em 1 hora)
        ↓
Link de redefinicao aparece nos logs (em dev) ou seria enviado por email (producao)
        ↓
Usuario acessa o link → formulario de nova senha
        ↓
Digita nova senha + confirmacao → senha atualizada com bcrypt
        ↓
Redirecionado para login com mensagem de sucesso
```

### 5.6 Fluxo "Encontrei este pet" (via NFC)

```
Pessoa escaneia tag NFC de um pet ativo
        ↓
Ve a pagina intermediaria com dados do pet
        ↓
Clica "Encontrei este pet"
        ↓
Preenche formulario (tudo opcional):
  - Nome
  - Telefone
  - Mensagem
  - Foto
  - Localizacao (automatica via GPS)
        ↓
Dados enviados → localizacao registrada + dono notificado
        ↓
Tela de agradecimento
```

---

## 6. Todas as paginas e o que cada botao faz

### Paginas publicas (qualquer pessoa acessa)

#### Pagina inicial (`/`)
- Se nao logado: pagina de boas-vindas com:
  - Hero com botoes "Criar Conta" e "Entrar"
  - Secao "Como funciona" (3 passos)
  - Secao "Tudo que voce precisa" (features)
  - **Estatisticas da comunidade**: total de pets, tutores e pontos no mapa (dinamico do banco)
  - **Pets perdidos recentes**: ultimos 3 alertas aprovados com foto e link
  - Botao "Explorar" para o mural da comunidade
- Se logado: redireciona para `/pets` (meus pets)

#### Explorar / Mural da comunidade (`/explorar`)
- **Pets perdidos**: grid de cards com foto, nome, raca, cidade, botao "Ajudar a encontrar"
- **Petshops e clinicas**: cards com nome, endereco, telefone, icone por categoria
- **Pets recentes**: galeria de pets cadastrados na comunidade
- Estado vazio com mensagem amigavel se nao houver dados

#### Login (`/auth/login`)
- **Campo email**: seu email cadastrado
- **Campo senha**: sua senha
- **Botao "Entrar"**: valida email/senha, cria sessao, redireciona para /pets
- **Link "Criar conta"**: vai para a pagina de registro
- **Link "Esqueci minha senha"**: vai para `/auth/esqueci-senha`

#### Registro (`/auth/registro`)
- **Campo nome**: seu nome completo
- **Campo email**: email (unico, sera usado para login)
- **Campo telefone**: telefone de contato
- **Campo senha**: minimo 6 caracteres
- **Campo confirmar senha**: deve ser igual
- **Botao "Criar conta"**: cria usuario, faz login automatico, redireciona para /pets
- **Links**: "Termos de Uso" e "Politica de Privacidade"

#### Esqueci Senha (`/auth/esqueci-senha`)
- **Campo email**: email cadastrado
- **Botao "Enviar link de recuperacao"**: gera token e mostra link nos logs (dev)
- **Link "Voltar ao login"**: retorna ao login

#### Redefinir Senha (`/auth/redefinir-senha/:token`)
- **Campo nova senha**: minimo 6 caracteres
- **Campo confirmar senha**: deve ser igual
- **Botao "Redefinir Senha"**: atualiza com bcrypt e redireciona para login

#### Termos de Uso (`/termos`)
- Pagina completa com 11 secoes: aceitacao, descricao do servico, cadastro, tags NFC, responsabilidades, petshops, privacidade, propriedade intelectual, limitacao de responsabilidade, alteracoes, contato

#### Politica de Privacidade (`/privacidade`)
- 10 secoes incluindo dados coletados, localizacao, compartilhamento, seguranca, LGPD (direitos do titular), cookies, retencao, contato

#### Scan NFC — Pagina Intermediaria (`/tag/:codigo`)
Essa e a pagina que abre quando alguem escaneia a tag NFC de um pet ativo.

- **Foto do pet**: grande, circular, no topo
- **Nome do pet**: em destaque
- **Descricao emocional**: "Sou docil, tenho medo de motos"
- **Botao "Ligar para o dono"**: abre o discador do celular
- **Botao "Enviar minha localizacao"**: captura GPS e envia ao sistema
- **Botao "Encontrei este pet"**: vai para `/tag/:codigo/encontrei`
- **Botao "Enviar foto"**: vai para `/tag/:codigo/enviar-foto`
- **Botao "Levar ao petshop parceiro"**: mostra petshop vinculado

Se o pet esta perdido, aparecem botoes extras:
- **Botao "Conversar com o dono"**: abre chat moderado
- **Banner de recompensa**: se o dono ofereceu recompensa

#### Encontrei Este Pet (`/tag/:codigo/encontrei`)
- Foto e nome do pet no topo
- **Campo nome** (opcional): nome de quem encontrou
- **Campo telefone** (opcional): telefone para contato
- **Campo mensagem** (opcional): descricao
- **Upload de foto** (opcional): foto do pet encontrado com preview
- **Botao "Enviar"**: registra localizacao + notifica dono
- Mensagem: "Quase tudo e opcional. Se preferir, apenas envie sua localizacao."

#### Enviar Foto (`/tag/:codigo/enviar-foto`)
- Foto e nome do pet no topo
- **Upload de foto** com preview e botao de remover
- **Botao "Enviar Foto"**: envia e notifica o dono
- Mensagem de agradecimento

#### Mapa (`/mapa`)
- **Mapa interativo** com Leaflet + OpenStreetMap
- **Botoes de filtro** no topo: petshops, pets perdidos, avistamentos, pontos de apoio
- **Clicar num pin**: abre popup com nome, categoria, link para detalhes
- **Botao "Minha localizacao"**: centraliza o mapa na sua posicao
- Lazy loading: so busca pins da area visivel (PostGIS bounding box)
- Clustering: pins proximos sao agrupados

#### Petshops (`/petshops`)
- **Lista de cards**: nome, endereco, telefone, distancia
- **Badge "Ponto de Apoio"**: se o petshop e parceiro oficial
- **Clicar no card**: abre detalhes completos

#### Detalhes do Petshop (`/petshops/:id`)
- Foto de capa, galeria, nome, endereco, telefone
- **Botao WhatsApp**: abre conversa no WhatsApp
- **Lista de servicos**: banho, tosa, consulta, etc.
- **Horario de funcionamento**
- **Mapa pequeno** com a localizacao
- **Botao "Agendar servico"**: abre formulario de agendamento

---

### Paginas do usuario logado

#### Meus Pets (`/pets`)
- **Grid de cards**: cada pet com foto, nome, tipo, raca, status
- **Badge verde "Seguro"** / **Badge vermelho "Perdido"**
- **Botao "Ver perfil"**: abre detalhes do pet
- **Botao "+" (Cadastrar pet)**: inicia o wizard de cadastro

#### Cadastrar Pet (`/pets/cadastro`) — Wizard
Formulario em etapas (uma pergunta por tela):
1. **Nome do pet**: "Qual o nome do seu pet?"
2. **Tipo**: botoes grandes (cachorro, gato, passaro, outro)
3. **Raca**: campo de texto com autocomplete ou "sem raca definida"
4. **Foto**: upload de foto com preview
5. **Idade e peso**: data de nascimento + peso em kg
6. **Descricao emocional**: "Conte algo sobre seu pet"
7. **Telefone de contato**: numero que aparece quando alguem escanear a tag

#### Perfil do Pet (`/pets/:id`)
- **Foto grande** do pet
- **Nome** em destaque
- **Descricao emocional** em italico
- **Badge de status**: seguro (verde) ou perdido (vermelho)
- **Contador de idade**: X anos, Y meses, Z dias (calculado automaticamente)
- **Idade humana equivalente**: ~N anos humanos (formula diferente para cao/gato)
- **Peso ideal**: comparacao com referencia por raca/porte (abaixo/ideal/acima)
- **Calendario de cuidados**: proximos 5 eventos (vacinas vencendo, consultas)
- **Botao WhatsApp** (se perdido): compartilhar alerta no WhatsApp
- **Cards de info**: tipo, raca, peso, porte
- **Botao "Editar"**: abre formulario de edicao
- **Botao "Carteira de Saude"**: abre vacinas e registros
- **Botao "Diario"**: abre diario do pet
- **Botao "Pet Perdido" (vermelho)**: abre formulario de reporte
- **Secao "Tags NFC"**: mostra tags vinculadas ao pet
- **Secao "Localizacoes recentes"**: ultimos avistamentos

#### Editar Pet (`/pets/:id/editar`)
- Mesmos campos do cadastro, em pagina unica (sem wizard)
- Valores ja preenchidos, upload de nova foto opcional
- Validacao aplicada (mesmo que no POST do cadastro)

#### Carteira de Saude (`/pets/:id/saude`)
- **Secao Vacinas**: lista com nome, data, proxima dose, veterinario
  - **Botao "Adicionar Vacina"**: abre formulario
  - **Botao "X" (excluir)**: remove (com verificacao de ownership)
- **Secao Registros**: consultas, exames, vermifugo, cirurgias
  - **Botao "Adicionar Registro"**: formulario com tipo (consulta, exame, etc.)
  - **Botao "X" (excluir)**: remove (com verificacao de ownership)
- O sistema envia lembretes automaticos quando vacinas estao perto de vencer (7 dias)

#### Diario do Pet (`/diario/:pet_id`)
- **Entradas de hoje**: lista de registros do dia (peso, humor, refeicao, etc.)
- **Historico**: ultimos 30 dias de entradas
- **Formulario**: tipo, descricao, valor numerico, foto
- **Upload de foto**: salvo em `/images/diario/` (separado das fotos de perfil)
- **Excluir entrada**: com verificacao de ownership

#### Lista de Conversas (`/chat`)
- Cards de conversas com: foto do pet, nome, ultima mensagem, data, status
- Se nao tem conversas: mensagem "Voce ainda nao tem conversas"
- Link para cada conversa: `/chat/:id`

#### Chat (`/chat/:id`)
- **Header**: foto e nome do pet, botao voltar para lista
- **Baloes de mensagem**: esquerda (encontrador) e direita (dono)
- **Indicador "Aguardando moderacao"**: mensagem pendente
- **Campo de texto + botao de foto + botao "Enviar"**
- Apenas participantes (tutor, iniciador) e admins podem acessar

#### Notificacoes (`/notificacoes`)
- Lista de notificacoes com icone por tipo (scan, alerta, chat, sistema, encontrado)
- **Clicar na notificacao**: marca como lida e redireciona
- **Badge no menu**: quantidade de nao lidas (atualiza em tempo real)

#### Agendamentos (`/agenda`)
- Lista de agendamentos do usuario com status
- **Botao "Cancelar"** (se status = agendado): cancela com verificacao de ownership
- Admin pode **Confirmar** agendamentos

#### Perfil (`/perfil`)
- Nome, email, telefone, cor do perfil
- **Botao "Salvar"**: atualiza via `Usuario.atualizarPerfil()` (sem query direta)

---

## 7. Painel do administrador

Acesse em `/admin`. Tem login separado usando credenciais do `.env`.

### Login Admin (`/admin/login`)
- **Email e senha**: definidos em `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH` no .env
- Senha comparada com **bcrypt** (nunca em texto puro)
- Rate limiting aplicado (mesmas regras do login de usuario)

### Dashboard (`/admin`)
Cards com metricas do sistema:
- **Total de usuarios**: quantas pessoas cadastradas
- **Total de pets**: quantos pets cadastrados
- **Pets perdidos ativos**: alertas em andamento
- **Petshops parceiros**: quantos pontos no sistema
- **Mensagens pendentes**: mensagens aguardando moderacao
- **Alertas pendentes**: alertas aguardando aprovacao

### Gerenciar Usuarios (`/admin/usuarios`)
- Tabela com todos os usuarios: ID, nome, email, telefone, role, data
- Badge de role: admin (roxo), usuario (cinza)
- **Botao "Promover/Rebaixar"**: `POST /admin/usuarios/:id/role` altera role entre 'usuario' e 'admin'

### Gerenciar Pets (`/admin/pets`)
- Tabela com todos os pets e nome do dono
- Status visivel (seguro/perdido)

### Gerenciar Petshops (`/admin/petshops`)
- Lista de petshops com status ativo/inativo

### Aprovar Pets Perdidos (`/admin/pets-perdidos`)
Esse e um dos paineis mais importantes.

- **Cards de alertas pendentes** (amarelo): foto do pet, nome, descricao
  - **Botao "Aprovar e Notificar"**: aprova o alerta, dispara notificacoes por proximidade (PostGIS) e notifica o tutor
  - **Botao "Rejeitar"**: rejeita o alerta e notifica o tutor com motivo
  
- **Cards de alertas aprovados** (vermelho):
  - **Botao "Escalar Alerta"**: expande o raio de notificacao (1km → 3km → cidade inteira), disparando novas notificacoes a cada escalamento
  
- **Cards resolvidos** (verde): apenas informativo

**Escalamento automatico**: o scheduler verifica a cada 30 minutos e escala automaticamente (6h → nivel 2, 24h → nivel 3) com notificacoes.

### Moderar Mensagens (`/admin/moderacao`)
Fila de mensagens do chat aguardando aprovacao.

- Cada mensagem mostra: remetente, conteudo, horario
- **Botao "Aprovar" (verde)**: `POST /admin/moderacao/:id/aprovar` — libera a mensagem
- **Botao "Rejeitar" (vermelho)**: `POST /admin/moderacao/:id/rejeitar` — bloqueia a mensagem
- Atualiza em tempo real via Socket.IO

### Gerenciar Tags NFC (`/tags/admin/lista`)
**Filtros**: Todas | Stock | Reserved | Sent | Active | Blocked

**Tabela**: codigo da tag, codigo de ativacao (parcialmente oculto), status, usuario, pet

**Acoes por status:**
- **Stock**: botao "Reservar"
- **Reserved**: botao "Marcar como Enviada"
- **Sent**: aguardando ativacao pelo cliente
- **Active**: botao "Bloquear"
- **Blocked**: botao "Desbloquear"

### Gerar Lote de Tags
- Quantidade, fabricante, observacoes
- **Botao "Gerar Lote"**: cria N tags com codigos unicos (PET-XXXXXX + XXXX-XXXX)

### Gerenciar Mapa (`/admin/gerenciar-mapa`)
- **Mapa Leaflet** para selecionar coordenadas
- **Formulario**: nome, categoria, endereco, lat/lng, telefone, whatsapp, servicos
- **Lista de pontos**: editar, ativar/desativar, deletar (usa `PontoMapa.deletar()`)

### Configuracoes (`/admin/configuracoes`)
| Configuracao | Padrao | O que faz |
|-------------|--------|-----------|
| raio_alerta_nivel1_km | 1 | Raio inicial de notificacao ao aprovar |
| raio_alerta_nivel2_km | 3 | Raio expandido apos X horas |
| raio_alerta_nivel3_km | 0 | 0 = notifica a cidade inteira |
| horas_para_nivel2 | 6 | Horas ate escalar automaticamente para nivel 2 |
| horas_para_nivel3 | 24 | Horas ate escalar automaticamente para nivel 3 |

---

## 8. Sistema de tags NFC

### Ciclo de vida de uma tag

```
STOCK → RESERVED → SENT → ACTIVE → (BLOCKED)

Stock:      Tag gerada pelo admin, guardada no estoque
Reserved:   Admin vinculou a um usuario (cliente comprou)
Sent:       Admin marcou como enviada (caixa saiu pra entrega)
Active:     Cliente ativou com 3 fatores (tag funcionando)
Blocked:    Admin bloqueou (fraude, defeito, etc.)
```

### Codigos da tag

Cada tag tem dois codigos:

1. **tag_code** (ex: `PET-82KJ91`): impresso na tag fisica, usado na URL
2. **activation_code** (ex: `AX9P-72KQ`): impresso na caixa, usado para ativar

A URL da tag e: `http://seusite.com/tag/PET-82KJ91`

### QR Code

Alem do NFC, cada tag tambem tem um QR Code (campo `qr_code` no banco) que aponta para a mesma URL. Alternativa para celulares sem NFC.

### Auditoria

Todo scan e registrado na tabela `tag_scans`, mesmo antes da ativacao. Rastreia:
- Onde a tag foi escaneada (lat/lng)
- Quando
- IP e user agent do navegador

---

## 9. Sistema de mapas

### Como funciona o lazy loading

O mapa NAO carrega todos os pins de uma vez (isso travaria com milhares de pontos).

1. Ao abrir o mapa, o sistema detecta a area visivel (bounding box)
2. Envia para a API: "me de os pins dentro desta area"
3. A API faz uma query PostGIS com `ST_MakeEnvelope` e `ST_Within`
4. Retorna apenas os pins visiveis como GeoJSON
5. Ao mover/dar zoom, busca novos pins da nova area
6. Pins ja carregados ficam em cache local (nao sao re-buscados)

### Tipos de pin no mapa

| Tipo | Icone | Quem cria |
|------|-------|-----------|
| Petshop | Loja (azul) | Admin |
| Veterinario | Cruz (verde) | Admin |
| Clinica | Estetoscopio (verde) | Admin |
| Abrigo | Coracao (rosa) | Admin |
| Hospital Pet | Hospital (vermelho) | Admin |
| Ponto de apoio | Escudo (roxo) | Admin |
| Pet perdido | Triangulo (vermelho) | Automatico (quando aprovado) |
| Avistamento | Ponto (laranja) | Automatico (quando alguem escaneia tag) |

### Clustering

Quando existem muitos pins proximos, sao agrupados em um circulo com numero. Ao dar zoom, os pins se separam. Usa `Leaflet.markercluster`.

---

## 10. Chat moderado

### Por que e moderado?

Para seguranca. O sistema e usado por desconhecidos encontrando pets. Sem moderacao:
- Alguem poderia enviar conteudo inadequado
- Dados sensiveis poderiam ser compartilhados (endereco, CPF)
- Golpes poderiam acontecer

### Como funciona

1. Quem encontrou o pet clica "Conversar" na pagina do scan
2. Digita uma mensagem ou envia foto
3. A mensagem fica PENDENTE (status_moderacao = 'pendente')
4. O admin ve a mensagem no painel de moderacao (em tempo real via Socket.IO)
5. Admin clica "Aprovar" → mensagem entregue ao dono instantaneamente
6. Admin clica "Rejeitar" → mensagem nao entregue
7. Quando o pet e encontrado e o caso resolvido, mensagens podem ser apagadas

### Lista de conversas

O usuario pode acessar `/chat` para ver todas as suas conversas (como tutor ou como encontrador), com preview da ultima mensagem aprovada.

### Tecnologia

Usa **Socket.IO** para comunicacao em tempo real. Canais:
- `/chat`: canal entre encontrador e dono do pet
- `/admin` ou `/notificacoes`: canal para admin e notificacoes em tempo real

---

## 11. Sistema de notificacoes e push

### Tipos de notificacao

| Tipo | Quando dispara | Exemplo |
|------|---------------|---------|
| **scan** | Alguem escaneia a tag do pet | "Alguem escaneou a tag do Thor!" |
| **alerta** | Pet perdido na regiao (via PostGIS) | "Pet perdido na sua regiao! Rex foi visto..." |
| **chat** | Nova mensagem aprovada no chat | "Nova mensagem sobre Thor" |
| **sistema** | Vacina vencendo, alerta rejeitado, etc. | "Vacina V10 de Thor vence em 3 dias" |
| **encontrado** | Pet encontrado/resolvido | "Thor foi encontrado!" |

### Notificacao por proximidade (PostGIS)

Quando um alerta de pet perdido e aprovado ou escalado:
1. Sistema busca a localizacao do alerta (lat/lng)
2. Converte o raio de km para metros
3. Executa query PostGIS: `ST_DWithin(ultima_localizacao, ST_MakePoint(lng, lat), raio_metros)`
4. Encontra todos os usuarios dentro do raio
5. Cria notificacoes em massa via `Notificacao.criarParaMultiplos()`
6. Envia Web Push para todos (se inscrito)
7. Emite via Socket.IO para atualizacao em tempo real

### Web Push

- Usa a biblioteca `web-push` com chaves VAPID
- Inscricoes salvas na tabela `push_subscriptions`
- O frontend pede permissao via modal amigavel (`permissions.js`)
- Service Worker recebe e exibe a notificacao nativa

---

## 12. PWA

O sistema funciona como aplicativo no celular (PWA = Progressive Web App).

### O que significa na pratica

- O usuario pode "instalar" o site no celular como se fosse um app
- Aparece na tela inicial com icone proprio
- Abre em tela cheia (sem barra do navegador)
- Funciona parcialmente offline (paginas em cache)
- Recebe notificacoes push nativas

### Arquivos envolvidos

- `manifest.json`: nome, icones, cores, orientacao
- `sw.js` (Service Worker): cache de assets, estrategia offline, push listener
- `pwa.js`: registra o service worker, mostra botao de instalacao, inscreve push
- `permissions.js`: modals de permissao (camera, GPS, notificacao)
- `offline.html`: pagina exibida quando sem internet

### Para instalar

No celular (Chrome/Safari), ao acessar o site:
1. Aparece um banner "Adicionar a tela inicial" (ou popup do navegador)
2. Clicar em "Instalar"
3. Icone do AIRPET aparece na tela inicial

---

## 13. Scheduler — Jobs automaticos

O `schedulerService.js` roda jobs em intervalos automaticos assim que o servidor inicia.

### Jobs ativos

| Job | Intervalo | O que faz |
|-----|-----------|-----------|
| **Escalar alertas** | A cada 30 min | Verifica alertas aprovados. Se passaram 6h → nivel 2. Se passaram 24h → nivel 3. Dispara notificacoes por proximidade a cada escalamento. |
| **Lembrete de vacinas** | A cada 6 horas | Busca vacinas com `data_proxima` nos proximos 7 dias. Cria notificacao para o tutor. |

### Configuracao

Os parametros (horas para escalar, raio por nivel) sao lidos da tabela `config_sistema` e podem ser editados em `/admin/configuracoes`.

### Primeira execucao

- Escalar alertas roda 10s apos o boot
- Lembretes de vacinas roda 30s apos o boot
- Depois seguem nos intervalos normais

---

## 14. Seguranca

| Protecao | Como funciona |
|----------|--------------|
| **Senhas** | Hash com bcrypt (12 rounds de salt). A senha real nunca e armazenada. |
| **Senha admin** | Comparada com `bcrypt.compare()` (nunca em texto puro). Rate limiting no login. |
| **Autenticacao** | Session no servidor + JWT em cookie httpOnly como fallback |
| **Headers HTTP** | Helmet configura headers de seguranca (XSS, clickjacking, HSTS, etc.) |
| **Rate limiting** | 100 req/15min (geral), 10 req/15min (login/admin), 5 req/15min (ativacao tag) |
| **SQL injection** | Queries 100% parametrizadas ($1, $2...). Nenhum dado concatenado no SQL. |
| **Validacao** | express-validator em formularios (email valido, senha minima, etc.). Validacao no PUT tambem. |
| **Credenciais** | Tudo no .env. Nunca no codigo. .env no .gitignore. |
| **Upload** | Multer com filtro (so imagens jpeg/jpg/png/gif/webp), limite 5MB, nome randomizado (crypto). |
| **Upload centralizado** | `utils/upload.js` evita duplicacao de configuracao multer. |
| **Fotos separadas** | Fotos do diario vao para `/images/diario/`, fotos de pets para `/images/pets/`. |
| **Tag NFC** | Ativacao exige 3 fatores simultaneos. Rate limit especifico na rota. |
| **Chat** | Toda mensagem passa pelo admin antes de ser entregue |
| **Admin** | Rotas protegidas por middleware `apenasAdmin` |
| **Ownership** | DELETE de vacinas, registros de saude e entradas do diario verifica se o recurso pertence ao usuario logado antes de deletar. |
| **Localizacao** | API `/api/localizacao` protegida com `estaAutenticado` — nao e mais publica. |
| **Chat protegido** | `GET /chat/:id` exige autenticacao. Apenas participantes (tutor/iniciador) e admins podem acessar. |
| **Recuperacao de senha** | Token unico com expiracao de 1h. Senha atualizada com bcrypt. |
| **MVC consistente** | Controllers usam models (sem queries SQL diretas). `perfilController` e `pontoMapaController` corrigidos. |

---

## 15. API endpoints

Para integrar com outros sistemas (app mobile nativo, automacoes, etc.):

### Localizacao (requer autenticacao)

```
POST /api/localizacao
Headers: Cookie: connect.sid=...
Body: { pet_id, latitude, longitude, cidade, ip }
Resposta: { sucesso: true, localizacao: {...} }

GET /api/localizacao/:petId
Headers: Cookie: connect.sid=...
Resposta: { sucesso: true, localizacoes: [{lat, lng, cidade, data}...] }
```

### Mapa (GeoJSON)

```
GET /api/mapa/pins?swLat=-15.8&swLng=-46.7&neLat=-15.7&neLng=-46.6&categorias=petshop,perdido
Resposta: GeoJSON FeatureCollection
{
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-46.65, -15.75] },
      properties: { id: 1, nome: "Pet Shop Amigo", categoria: "petshop", icone: "store" }
    }
  ]
}
```

### Notificacoes

```
GET /notificacoes (HTML ou JSON dependendo do Accept header)
POST /notificacoes/:id/lida → { sucesso: true }
```

### Chat

```
GET /chat (lista de conversas do usuario — requer auth)
GET /chat/:id (tela de conversa — requer auth + ser participante)
POST /chat/iniciar (inicia conversa — requer auth, body: { pet_perdido_id })
```

### Agendamentos

```
GET /agenda (listar agendamentos do usuario)
POST /agenda (criar agendamento)
POST /agenda/:id/cancelar (cancelar — verifica ownership)
POST /agenda/:id/confirmar (confirmar — apenas admin)
```

### Admin

```
POST /admin/pets-perdidos/:id/aprovar (aprova alerta + notifica proximos)
POST /admin/pets-perdidos/:id/rejeitar (rejeita alerta + notifica tutor)
POST /admin/pets-perdidos/:id/escalar (escala nivel + notifica novo raio)
POST /admin/moderacao/:id/aprovar (aprova mensagem do chat)
POST /admin/moderacao/:id/rejeitar (rejeita mensagem do chat)
POST /admin/usuarios/:id/role (altera role: body { role: 'admin' ou 'usuario' })
```

### NFC

```
GET /tag/:tag_code (processamento do scan — publico)
GET /tag/:tag_code/encontrei (formulario "encontrei" — publico)
POST /tag/:tag_code/encontrei (envia dados + foto — publico)
GET /tag/:tag_code/enviar-foto (formulario de foto — publico)
POST /tag/:tag_code/enviar-foto (upload da foto — publico)
```

### Auth

```
POST /auth/registro (criar conta)
POST /auth/login (fazer login)
GET /auth/logout (encerrar sessao)
POST /auth/esqueci-senha (gerar token de recuperacao)
GET /auth/redefinir-senha/:token (formulario de nova senha)
POST /auth/redefinir-senha/:token (salvar nova senha)
```

---

## 16. Como integrar

### Com um app mobile nativo

O AIRPET funciona como backend API. Para um app React Native ou Flutter:

1. Use os endpoints `/api/*` para dados
2. Autenticacao via JWT (envie o token no header `Authorization: Bearer <token>`)
3. Socket.IO para chat e notificacoes em tempo real
4. A pagina NFC (`/tag/:codigo`) funciona diretamente no browser do celular

### Com petshops existentes

1. Admin cria o petshop no painel (`/admin/gerenciar-mapa`)
2. Petshop aparece no mapa e na pagina Explorar
3. Clientes do petshop compram tags NFC
4. Petshop funciona como ponto de apoio para pets encontrados

### Com servicos de email (producao)

A recuperacao de senha atualmente loga o link no servidor (dev). Para producao:
1. Integre com um servico SMTP (Nodemailer + Gmail/SendGrid/Mailgun)
2. No `authController.esqueciSenha`, substitua o `logger.info` por envio de email
3. O template do email ja pode usar o link gerado

### Com WhatsApp

Botao de compartilhamento ja implementado no perfil do pet perdido. A funcao `compartilharWhatsApp()` esta em `app.js`. Para automatizar:
1. Use a API do WhatsApp Business
2. Ao aprovar pet perdido, envie mensagem automatica para petshops proximos

---

## 17. Tecnologias usadas

### Backend
| Tecnologia | Versao | Para que serve |
|-----------|--------|----------------|
| Node.js | 18+ | Runtime JavaScript no servidor |
| Express | 5.x | Framework web (rotas, middlewares) |
| PostgreSQL | 14+ | Banco de dados relacional |
| PostGIS | 3.x | Extensao geografica (mapas, proximidade, ST_DWithin) |
| Socket.IO | 4.x | WebSocket para chat e notificacoes em tempo real |
| bcrypt | 6.x | Hash de senhas (12 rounds) |
| jsonwebtoken | 9.x | Tokens JWT para autenticacao |
| express-session | 1.x | Gerenciamento de sessoes |
| connect-pg-simple | 10.x | Armazenamento de sessoes no PostgreSQL |
| helmet | 8.x | Seguranca de headers HTTP |
| express-rate-limit | 8.x | Limitacao de requisicoes |
| express-validator | 7.x | Validacao de inputs |
| multer | 2.x | Upload de arquivos |
| web-push | 3.x | Web Push notifications (VAPID) |
| dotenv | 17.x | Variaveis de ambiente |

### Frontend
| Tecnologia | Para que serve |
|-----------|----------------|
| EJS | Templates HTML renderizados no servidor |
| TailwindCSS 3 | Estilizacao (classes utilitarias) |
| Leaflet | Mapas interativos |
| OpenStreetMap | Tiles/imagens do mapa (gratis) |
| Leaflet.markercluster | Agrupamento de pins no mapa |
| Socket.IO Client | Chat e notificacoes em tempo real no navegador |
| Font Awesome 6 | Icones |
| Service Worker | Cache offline, PWA e push notifications |

### Infraestrutura
| Item | Detalhes |
|------|---------|
| Arquitetura | MVC (Model-View-Controller) |
| Template engine | EJS (server-side rendering) |
| Comunicacao real-time | WebSocket via Socket.IO |
| Dados geograficos | PostGIS (ST_DWithin, ST_MakeEnvelope, ST_MakePoint) |
| Autenticacao | Session + JWT (dupla camada) |
| PWA | manifest.json + Service Worker + Web Push |
| Jobs automaticos | schedulerService.js (setInterval — escalar alertas, lembretes vacinas) |
| Upload centralizado | utils/upload.js (factory de multer por diretorio) |

---

## Resumo rapido

| Voce quer... | Faca isso |
|-------------|-----------|
| Criar conta | Acesse /auth/registro |
| Recuperar senha | Acesse /auth/esqueci-senha |
| Cadastrar pet | Acesse /pets/cadastro (precisa estar logado) |
| Ver perfil do pet | Acesse /pets/:id (ve idade, peso ideal, calendario) |
| Ver saude do pet | Acesse /pets/:id/saude |
| Ver diario do pet | Acesse /diario/:pet_id |
| Ver o mapa | Acesse /mapa |
| Explorar a comunidade | Acesse /explorar |
| Ver minhas conversas | Acesse /chat |
| Ativar uma tag NFC | Escaneie a tag → siga as instrucoes na tela |
| Reportar pet perdido | No perfil do pet → botao "Pet Perdido" |
| Compartilhar pet perdido | No perfil do pet perdido → botao WhatsApp |
| Agendar servico | Na pagina do petshop → "Agendar" |
| Cancelar agendamento | POST /agenda/:id/cancelar |
| Acessar o admin | Acesse /admin/login (usa credenciais do .env) |
| Gerar tags NFC | Admin → /tags/admin/lista → "Gerar Lote" |
| Aprovar pet perdido | Admin → /admin/pets-perdidos → "Aprovar e Notificar" |
| Rejeitar pet perdido | Admin → /admin/pets-perdidos → "Rejeitar" |
| Escalar alerta | Admin → /admin/pets-perdidos → "Escalar" (ou esperar automatico) |
| Moderar mensagens | Admin → /admin/moderacao → Aprovar/Rejeitar |
| Alterar role de usuario | Admin → /admin/usuarios → alterar role |
| Adicionar ponto no mapa | Admin → /admin/gerenciar-mapa |
| Mudar raio de notificacao | Admin → /admin/configuracoes |
| Ver termos de uso | Acesse /termos |
| Ver politica de privacidade | Acesse /privacidade |

---

## Changelog — Ultimas alteracoes

### Seguranca
- **Senha admin com bcrypt**: login em `/admin/login` agora usa `bcrypt.compare()` ao inves de comparacao em texto puro. Suporta `ADMIN_PASSWORD_HASH` (bcrypt hash) no .env.
- **API localizacao protegida**: `/api/localizacao` agora exige autenticacao (middleware `estaAutenticado`).
- **Chat protegido**: `GET /chat/:conversaId` agora exige autenticacao. Apenas participantes e admins podem acessar.
- **Ownership em DELETE**: `deletarVacina`, `deletarRegistro` (saudeController) e `deletarEntrada` (diarioController) verificam se o recurso pertence ao pet do usuario antes de deletar.
- **Validacao no PUT**: `PUT /pets/:id` agora aplica `validarPet` e `validarResultado`.

### Rotas criadas
- `/termos` e `/privacidade` — paginas estaticas completas
- `/auth/esqueci-senha` e `/auth/redefinir-senha/:token` — fluxo completo de recuperacao
- `/tag/:codigo/encontrei` e `/tag/:codigo/enviar-foto` — formularios para quem encontrou o pet
- `/chat` — lista de conversas do usuario
- `/explorar` — mural da comunidade

### Inconsistencias corrigidas
- `perfilController.atualizar` agora usa `Usuario.atualizarPerfil()` (sem query SQL direta)
- `pontoMapaController.deletar` agora usa `PontoMapa.deletar()` (sem query SQL direta)
- `diarioController` agora usa `logger` ao inves de `console.error`
- Fotos do diario salvas em `/images/diario/` (separado de `/images/pets/`)
- Upload centralizado em `utils/upload.js`
- Adicionado metodo `deletar()` no model `PontoMapa`
- Adicionados metodos `atualizarPerfil()` e `atualizarRole()` no model `Usuario`

### Features novas
- **Notificacao por proximidade**: ao aprovar ou escalar alerta, sistema busca usuarios no raio via PostGIS e notifica em massa (push + Socket.IO)
- **Escalamento automatico**: scheduler roda a cada 30min, escala alertas (6h→nivel2, 24h→nivel3)
- **Lembretes de vacinas**: scheduler roda a cada 6h, notifica tutores sobre vacinas vencendo em 7 dias
- **Rejeitar alerta**: admin pode rejeitar alerta de pet perdido (notifica o tutor)
- **Moderar mensagens do admin**: rotas `POST /admin/moderacao/:id/aprovar` e `/rejeitar`
- **Alterar role de usuario**: rota `POST /admin/usuarios/:id/role`
- **Agendamento completo**: cancelar e confirmar agendamentos com verificacao de ownership
- **Contador de idade**: calcula anos/meses/dias + idade humana equivalente (formula diferente para cao/gato)
- **Peso ideal**: referencia por raca/porte, compara com peso atual (abaixo/ideal/acima)
- **Calendario de cuidados**: proximos 5 eventos (vacinas e consultas futuras)
- **Compartilhar WhatsApp**: botao no perfil do pet perdido + funcao global `compartilharWhatsApp()`
- **Home dinamica**: estatisticas da comunidade + ultimos pets perdidos na landing page
- **Pagina Explorar**: mural com pets perdidos, petshops/clinicas em destaque, pets recentes
- **Link Explorar no nav**: adicionado ao menu de navegacao
