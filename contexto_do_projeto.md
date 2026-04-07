# 1. Visão Geral do Sistema

## Objetivo principal do projeto

O AIRPET é uma plataforma para identificação, proteção e recuperação de pets, combinando:
- cadastro de tutores e pets;
- ativação/uso de tags NFC;
- fluxo de pet perdido (com aprovação administrativa);
- chat e notificações;
- mapa/geolocalização;
- área administrativa;
- ecossistema de parceiros/petshops (onboarding, moderação e painel dedicado).

Esse objetivo está explícito na descrição do projeto e no conjunto de rotas/controllers centrais (`Sistema de identificacao e recuperacao de pets via NFC — PWA com mapas, chat moderado e dashboard admin`), além dos fluxos de `pets_perdidos`, `nfc_tags`, `chat`, `notificacoes` e `petshop`.

## Arquitetura macro

Arquitetura predominante: **monólito modular Node.js/Express com SSR (EJS)**, com APIs internas e externas no mesmo deploy.

Componentes macro:
- **Aplicação web SSR + API** em Express:
  - composição em camadas (`routes -> controllers -> services -> models -> PostgreSQL`);
  - views EJS em `src/views`;
  - assets estáticos e PWA em `src/public`;
  - API mobile/sync em `src/routes/syncApiRoutes.js`.
- **Canal realtime** via Socket.IO:
  - namespaces para chat/admin/notificações em `src/sockets`.
- **Banco PostgreSQL**:
  - acesso com `pg` (SQL manual em models), sem ORM;
  - migrações com `node-pg-migrate`;
  - baseline com muitas tabelas de domínio social, parceiro e métricas.
- **Componente edge separado**:
  - Cloudflare Worker com Durable Objects (`workers/airpet-edge`) para controle de concorrência por slot e encaminhamento ao origin;
  - consumer opcional de Queue para webhook interno.

Em resumo: não é microserviços no núcleo da aplicação; é um monólito rico com um componente edge especializado acoplado por HTTP/webhook.


# 2. Stack Tecnológico e Dependências Principais

## Linguagens, runtime e frameworks

- **Node.js + CommonJS** no backend (sem campo `engines` fixado no `package.json`).
- **Express `^5.2.1`** para HTTP.
- **EJS `^5.0.1`** para renderização server-side.
- **Socket.IO `^4.8.3`** para tempo real.
- **TailwindCSS `^3.4.17`** + PostCSS/Autoprefixer para CSS.
- **JavaScript vanilla no frontend** (sem React/Vue/Angular).

## Banco de dados e camada de dados

- **PostgreSQL** com driver **`pg ^8.20.0`**.
- **PostGIS** habilitado no baseline de migração (uso geoespacial).
- **Sem ORM/query builder tradicional**:
  - SQL manual parametrizado centralizado em `src/models`.
- **Migrações** com **`node-pg-migrate ^8.0.4`** (`migrations/*.mjs`, script `scripts/run-pgm.cjs`).
- **Pré-start obrigatório**: executar `npm run db:migrate` no mesmo ambiente/.env da API antes de `npm run dev`/`npm start` (inclui schema comercial de TAG NFC, como `plan_definitions`).
- **Sessão persistente em PG** com `express-session` + `connect-pg-simple` (tabela `user_sessions`).

## Segurança, autenticação e validação

- `bcrypt` para hash de senha.
- `jsonwebtoken` para JWT.
- `helmet` para hardening de headers.
- `express-rate-limit` para limitação de taxa.
- `express-validator` para validações HTTP/entrada.
- `cookie-parser` e `method-override`.

## Infra, integrações e armazenamento

- **Cloudflare Worker + Durable Objects** (wrangler).
- **Cloudflare R2 / S3 compatível** via `@aws-sdk/client-s3`.
- **Resend** para envio de e-mail.
- Integrações externas por `fetch` (ex.: Nominatim/OSM, ViaCEP, IBGE em módulos front/backend específicos).

## Testes e qualidade

- **Lint** com ESLint (`eslint.config.cjs`) e regra arquitetural explícita: SQL deve ficar em `src/models`.
- **Não foi encontrada suíte de testes automatizada formal** (Jest/Vitest/Cypress/Playwright não aparecem como setup principal no `package.json` atual).


# 3. Estrutura de Pastas e Arquitetura

## Árvore de diretórios (pastas principais)

```text
AIRPET/
  docs/
  migrations/
  scripts/
  src/
    config/
    controllers/
    middlewares/
    models/
    public/
      css/
      images/
      js/
      manifest.json
      sw.js
    routes/
    services/
      metrics/
    sockets/
    utils/
    views/
      admin/
      agenda/
      auth/
      chat/
      explorar/
      mapa/
      nfc/
      parceiros/
      perfil/
      pets/
      pets-perdidos/
      petshop-panel/
      petshops/
      partials/
  workers/
    airpet-edge/
      src/
```

## Responsabilidade de cada pasta

- `src/config`
  - configuração transversal (DB pool, sessão, baseline/migração, etc.).
  - exemplos: `database.js`, `session.js`, `migrationBaselineStatements.js`.

- `src/routes`
  - desenho de endpoints e composição de sub-rotas.
  - `index.js` concentra o roteamento macro web/API.

- `src/controllers`
  - orquestração HTTP (request/response, validação final, flash/redirect/json).
  - chama serviços e models; não deveria conter SQL bruto.

- `src/services`
  - regras de negócio e integrações externas.
  - inclui subdomínio de métricas em `src/services/metrics`.

- `src/models`
  - acesso a dados SQL e mapeamento operacional de entidades.
  - regra de projeto (ESLint): SQL deve estar aqui.

- `src/middlewares`
  - autenticação, autorização, rate limit, validações, persistência de upload e métricas de acesso.

- `src/views`
  - templates EJS por contexto funcional.
  - `partials` contém layout compartilhado (`header`, `nav`, `footer`, shells).

- `src/public`
  - estáticos (JS/CSS/imagens), PWA (`manifest`, `sw.js`) e módulos JS de performance/offline.

- `src/sockets`
  - handlers de Socket.IO segmentados por área funcional (chat/admin/notificação).

- `src/utils`
  - utilitários técnicos (logger, geocoding, upload, contratos de sync etc.).

- `migrations`
  - evolução de schema via arquivos timestampados.

- `scripts`
  - utilitários operacionais e manutenção (DB health, migração de imagens, reconciliações, SQL auxiliar).

- `workers/airpet-edge`
  - componente edge independente (proxy por slot + queue consumer opcional).

## Padrões de nomenclatura de arquivos

- `controllers`: `*Controller.js` em camelCase (`authApiController.js`, `petPerdidoController.js`).
- `routes`: `*Routes.js` em camelCase + `index.js`.
- `services`: `*Service.js` em camelCase.
- `models`: entidades majoritariamente em PascalCase singular (`Usuario.js`, `Pet.js`, `PetshopAccount.js`).
- `views`: arquivos `.ejs` com nomes descritivos, frequentemente em kebab-case.
- `migrations`: `timestamp_descricao.mjs`.
- `scripts`: utilitários em `.cjs`, nomes em kebab-case.


# 4. Regras de Negócio e Fluxos Principais (Crucial)

## Entidades principais do sistema

Blocos de domínio identificados no schema baseline + models:

- **Identidade/Acesso**
  - `usuarios`, `user_sessions`, `refresh_tokens`, `api_idempotency_responses`.

- **Núcleo pet/NFC/recuperação**
  - `pets`, `nfc_tags`, `tag_scans`, `pets_perdidos`, `localizacoes`, `conversas`, `mensagens_chat`, `notificacoes`.

- **Social/feed**
  - `publicacoes`, `curtidas`, `comentarios`, `seguidores`, `reposts`, `post_media`, `post_mentions`, `comment_mentions`, `post_tags`, `post_stats`, `post_idempotency_keys`.

- **Parceiros/Petshop**
  - `petshops`, `petshop_partner_requests`, `petshop_accounts`, `petshop_profiles`, `petshop_posts`, `petshop_products`, `petshop_services`, `petshop_schedule_rules`, `petshop_appointments`, `petshop_followers`, `petshop_reviews`, `pet_petshop_links`, `pet_petshop_link_requests`, `petshop_lost_pet_alerts`.

- **Métricas/analítico**
  - várias tabelas `*_raw`, `*_agg`, snapshots e sinais de risco.

## Fluxo de Autenticação e Autorização

### Web (sessão + cookie)

- Login web cria:
  - `req.session.usuario`;
  - cookie JWT `airpet_token` (httpOnly), com fallback em middlewares.
- Proteção de rotas web:
  - `estaAutenticado` verifica sessão;
  - se sessão ausente, tenta JWT de cookie e restaura sessão;
  - sem autenticação, redireciona para `/auth/login`.

### API/mobile (Bearer + refresh rotativo)

- `POST /api/v1/auth/mobile-login`:
  - valida credenciais;
  - retorna `access_token` curto e `refresh_token` opaco.
- `POST /api/v1/auth/refresh`:
  - valida hash do refresh;
  - revoga token usado;
  - emite novo par (rotação).
- `POST /api/v1/auth/mobile-logout`:
  - revoga refresh enviado.
- Proteção API:
  - `estaAutenticadoAPI` aceita sessão ou Bearer;
  - retorna JSON `401` em vez de redirect.

### Autorização por papel/guardas

- `apenasAdmin`: valida sessão admin ou `usuario.role === 'admin'`.
- Fluxo petshop possui guardas próprios:
  - autenticação de parceiro;
  - ownership;
  - status/aprovação de conta.

## Lógicas de negócio críticas, restrições e validações

### Regras de negócio centrais observadas

- **Cadastro de usuário**
  - e-mail único;
  - bloqueio por `MAX_USUARIOS` (quando configurado).

- **Login**
  - usuário bloqueado não autentica (`usuario.bloqueado`).

- **Pet perdido**
  - somente dono do pet pode reportar;
  - alerta nasce como `pendente`, dependente de aprovação admin;
  - resolução do caso:
    - marca alerta como resolvido;
    - retorna status do pet para `seguro`;
    - encerra/limpa conversas e mensagens vinculadas (proteção de dados sensíveis citada no código).

- **Onboarding de parceiro petshop**
  - valida dados essenciais (endereço, geolocalização, senha e confirmação);
  - cria slug único por tentativa incremental;
  - cria petshop + conta + solicitação em transação.

### Validações de entrada

- `express-validator` com cadeias robustas por fluxo.
- Estratégia de whitelist:
  - `camposPermitidos`/`camposPermitidosSe` bloqueando campos extras.
- Em falhas:
  - JSON `422` para APIs;
  - flash + redirect para HTML.

### Restrições de banco relevantes

- FKs e uniques amplas.
- `CHECK` identificados no baseline, por exemplo:
  - `rating` de avaliação de petshop entre 1 e 5;
  - `dia_semana` em regra de agenda entre 0 e 6.
- Triggers/funções relevantes:
  - sincronização de contadores de posts (`fn_sync_post_stats` + triggers);
  - limite de produtos ativos por petshop (`fn_petshop_products_limit` + trigger).

### Proteções adicionais

- Rate limiting por contexto (`geral`, `auth`, `ativação`, `chat público`).
- API sync com ETag/If-None-Match.
- PATCH de perfil com idempotência (`Idempotency-Key`) persistida.

## Pontos de atenção (sem inferência além do código)

- Há sinais de coexistência de papéis/nomes (`usuario`, `tutor`, `admin`) em diferentes áreas; isso pode ser evolução histórica ou débito de consistência.
- `authController` (não detalhado aqui integralmente) usa estrutura em memória para reset de senha em pontos do fluxo; em ambiente multi-instância isso tende a fragilizar persistência.
- Existem chamadas `fetch('http://127.0.0.1:7619/...')` em middlewares de validação/geo, indicando telemetria/debug local embutido.


# 5. Design System e UI/UX

## Biblioteca de componentes/framework CSS

- **TailwindCSS** como base utilitária.
- **Sem biblioteca de componentes pronta** (MUI/Chakra/AntD etc. não identificadas).
- Forte camada de **CSS custom** com classes semânticas e tokens.

## Tema (cores, tipografia, espaçamentos)

- Tailwind extend:
  - paletas `primary` e `accent`;
  - fonte `Inter` como base sans.
- Tokens e tema semântico em `design-system.css`:
  - variáveis (`--ink`, `--text`, `--accent`, `--radius`, etc.).
- **Tema dinâmico por backend**:
  - valores são injetados no `header.ejs` por CSS vars (`--color-primary`, etc.) vindas de `ConfigSistema` em `app.js`.
- Convivência de utilitários Tailwind + componentes CSS custom (`.btn-primary`, `.card`, `.input-field`, shells admin etc.).

## Padrões de criação de UI

- SSR com EJS e composição por partials/layouts.
- Padrão de shell:
  - `header` define tema, inclui CSS e módulos JS globais;
  - `nav/footer` e partials reutilizadas entre páginas.
- Convenções de classes:
  - utilitárias Tailwind para layout/microestilo;
  - prefixos semânticos locais (`airpet-*`, `btn-*`, `partner-*`).
- Admin e app compartilham base visual comum (mesma fundação de CSS, com ajustes por contexto).


# 6. Gerenciamento de Estado e Integrações (API)

## Gerenciamento de estado

### Estado global/local no frontend

- Não há Redux/Zustand/Context API/React Query (não há app React).
- Estado global é implementado por módulos singleton em `window`:
  - `AIRPET_REQ_COORDINATOR`: dedupe, fila por prioridade, cancelamento por grupo, limite por chave.
  - `AIRPET_SWR_CACHE`: cache stale-while-revalidate em memória + `localStorage`.
  - `AIRPET_LOADING`: hub de loading/lock global.
  - `AIRPET_OFFLINE_QUEUE`: fila offline em IndexedDB para writes.
- Estado local de telas é mantido em JS por página (IIFE, variáveis locais, estado de DOM).

### Estado de autenticação

- Web: sessão persistida em PostgreSQL (`connect-pg-simple`) + cookies.
- API/mobile: Bearer JWT curto + refresh token com rotação e revogação em banco.

## Integração com backend e APIs externas

### Padrão de comunicação interna

- Cliente HTTP predominante: `fetch` nativo (browser/Node).
- Não há camada universal de interceptors tipo Axios.
- Para API de sync:
  - ETag/If-None-Match em GET;
  - idempotência em PATCH de perfil;
  - respostas JSON com contrato de versão (`schemaVersion`).

### Integrações externas identificadas

- **Nominatim/OpenStreetMap** (reverse geocoding) com throttle e timeout.
- **ViaCEP** (fluxos de CEP no front).
- **IBGE Localidades** (dados de estado/município no mapa).
- **Resend** (envio de e-mails transacionais).
- **Cloudflare R2** (storage S3-compatible via AWS SDK v3).
- **Cloudflare Worker + Durable Object + Queue webhook** para controle de tráfego e integração interna.

### Resiliência e comportamento de erro/retry

- Há `try/catch` recorrente e fallback em diversos pontos.
- Retry explícito aparece pontualmente (não como política central de transporte).
- SWR revalida em background; fila offline reenvia operações quando conectividade retorna.
- Não existe estratégia global única de retry exponencial/interceptor para todo o sistema.


# 7. Padrões de Código e Convenções

## Regras implícitas para novas features

- Respeitar separação de camadas:
  - `routes` definem endpoint;
  - `controllers` orquestram e respondem;
  - `services` concentram regra/integracão;
  - `models` concentram SQL/acesso a dados.
- Manter SQL fora de controllers/services/routes (regra reforçada via ESLint).
- Seguir padrões de naming já consolidados por camada.
- Em fluxos com formulário e API mista:
  - preservar comportamento dual de resposta (HTML com flash vs JSON com status apropriado).
- Em novas rotas mutáveis:
  - considerar idempotência quando houver risco de replay;
  - aplicar rate limiting adequado ao risco.

## Padrões de tratamento de erros e logs

- Padrão dominante:
  - `try/catch` com `logger.error(...)`;
  - feedback amigável para usuário (flash + redirect no web);
  - JSON com códigos corretos para API.
- Códigos recorrentes observados:
  - `401` auth;
  - `422` validação;
  - `429` rate limit;
  - `500` falha interna;
  - `404/503` em cenários específicos.
- Logger custom central:
  - níveis `info/warn/error`,
  - request logger próprio,
  - banner de startup,
  - logs de query lenta e falha no módulo de DB.

## Guardrails práticos para futuros agentes de IA

- Antes de alterar regra de negócio, localizar o fluxo completo em:
  - rota -> controller -> service -> model -> migração/schema.
- Em qualquer mudança de autenticação:
  - avaliar impacto em web (sessão/cookie) e API mobile (Bearer/refresh) ao mesmo tempo.
- Em mudanças de UI:
  - preservar tokens e variáveis de tema dinâmico injetadas pelo backend.
- Em mudanças de dados:
  - verificar constraints/triggers existentes no baseline e migrações incrementais.
- Em mudanças de performance front:
  - considerar integração com `requestCoordinator`, `swrCache` e `offlineWriteQueue` para não quebrar as premissas de UX offline/revalidação.

---

# Apêndices (mesmo documento — onboarding operacional)

## Matriz: onde alterar por tipo de feature

Use esta tabela como mapa de navegação; a ordem típica de implementação é **rota → middlewares → controller → service → model → view/JS estático → migração** (quando houver persistência nova).

| Tipo de mudança | Entrada (HTTP/API) | Regra de negócio | Persistência | UI / cliente | Observações no AIRPET |
|-----------------|--------------------|------------------|--------------|--------------|------------------------|
| Nova rota web (página) | `src/routes/*Routes.js` + `src/routes/index.js` | `src/controllers/*` | `src/models/*` se precisar de dados | `src/views/**/*.ejs`, `src/public/js/*.js` | Proteger com `estaAutenticado` ou deixar público conforme caso. |
| Nova rota API JSON | `src/routes/*Routes.js` ou `syncApiRoutes.js` | `src/controllers/*` | `src/models/*` | `fetch` em `src/public/js` ou app mobile | Usar `estaAutenticadoAPI`; validação com `express-validator` + `validarResultado`. |
| Auth web (login/sessão/cookie) | `src/routes/authRoutes.js`, `authMiddleware.js` | `src/services/authService.js`, `src/controllers/authController.js` | `Usuario`, `user_sessions` | `src/views/auth/*.ejs` | JWT em cookie `airpet_token`; sessão em PG. |
| Auth mobile (Bearer + refresh) | `syncApiRoutes.js` | `authApiController.js`, `authService.js` | `RefreshToken` | cliente que chama `/api/v1/auth/*` | Rotacionar refresh; não assumir só web. |
| Pet / cadastro / perfil pet | `petRoutes.js`, controllers de pet | `petService.js`, `petController.js` | `Pet`, `Raca`, etc. | `src/views/pets/**` | Validadores em `validator.js` / `writeRouteValidators.js`. |
| NFC / tags / ativação | `nfcRoutes.js`, `tagRoutes.js` | `nfcController.js`, `tagService.js` | `NfcTag`, `TagScan`, `TagBatch` | `src/views/nfc/**` | Rate limit de ativação (`limiterAtivacao`) onde aplicável. |
| Pet perdido / alertas | `petPerdidoRoutes.js`, `index.js` (`/alerta/:id`) | `petPerdidoController.js` | `PetPerdido`, `Pet` | `src/views/pets-perdidos/**` | Fluxo `pendente` → aprovação admin; página pública só com `aprovado` + pet `perdido`. |
| Chat | `chatRoutes.js` | `chatController.js` | `Conversa`, `MensagemChat` | `src/views/chat/**`, `chat.js` | Socket em `src/sockets`; rate limit chat público. |
| Mapa / pontos | `mapaRoutes.js` | `mapaController.js`, `mapaService.js` | `PontoMapa`, `Localizacao` | `mapa.js`, `views/mapa/**` | Geo: `geocoding.js`, `geoValidationMiddleware.js`. |
| Feed / explorar / social | `explorarRoutes.js` | `explorarController.js` | `Publicacao`, `Seguidor`, `Curtida`, etc. | `views/explorar/**`, `feed.ejs` | Triggers em `post_stats`; idempotência em posts onde existir. |
| Notificações / push | `notificacaoRoutes.js` | `notificacaoController.js`, `notificacaoService.js` | `Notificacao`, `push_subscriptions` | partials + `pwa.js` | `io` injetado em app; VAPID em `res.locals`. |
| Admin | `adminRoutes.js` (path `ADMIN_PATH`) | `adminController.js` | vários models | `views/admin/**` | `apenasAdmin`; sessão `admin` legada ou `usuario.role === 'admin'`. |
| Parceiro petshop (cadastro público) | `partnerRoutes.js`, `publicPartnerController` | `petshopOnboardingService.js` | `Petshop`, `PetshopAccount`, `PetshopPartnerRequest` | `views/parceiros/**` | Transação; slug único; conta `pendente_aprovacao`. |
| Painel petshop | `petshopPanelRoutes.js` | `petshopPanelController.js` | `PetshopAccount`, perfis/produtos | `views/petshop-panel/**` | Middlewares `petshopAuthMiddleware`, owner, approval. |
| Configuração global / tema PWA | `app.js` (locals), rotas admin de config | `ConfigSistema` | `config_sistema` | `header.ejs`, `manifest` dinâmico | Cores e ícones vêm de DB; rebuild CSS se mudar tokens Tailwind. |
| Upload / mídia | rotas com `multer` + `persistUploadMiddleware` | controllers + `storageService.js` | URLs em models | crop modals, previews | `STORAGE_DRIVER=r2|local`; métricas em `metricsService`. |
| Email transacional | — | `emailService.js` | — | — | `RESEND_API_KEY`; templates em código. |
| Edge / fila Cloudflare | — | `workers/airpet-edge/src/index.js` | — | — | `ORIGIN_BASE_URL`, `SLOT`, webhook opcional para `internalWebhooks`. |
| Migração de schema | — | — | `migrations/*.mjs` + baseline em `migrationBaselineStatements.js` | — | `npm run db:migrate`; alinhar models com SQL. |

## Checklist de risco de regressão por domínio

Marque mentalmente antes de mergear alterações grandes.

### Autenticação e sessão
- [ ] Rotas web que dependem de `estaAutenticado` ainda redirecionam com cookie/sessão?
- [ ] Rotas API usam `estaAutenticadoAPI` e não quebram Bearer vs sessão?
- [ ] Mobile: refresh rotativo e revogação não foram enfraquecidos?
- [ ] Cookies `airpet_token` / `connect.sid` e limpeza em logout continuam coerentes?

### Dados e SQL
- [ ] Novas queries estão em `src/models` (ESLint `no-restricted-imports`)?
- [ ] Placeholders `$1, $2` em todas as queries dinâmicas?
- [ ] Migração nova não conflita com triggers (`post_stats`, `petshop_products_limit`) e CHECKs?

### Pet perdido e moderação
- [ ] Alerta público só exibe conteúdo “ativo” com `status === 'aprovado'` e pet `perdido`?
- [ ] Resolução ainda encerra conversas e remove mensagens quando aplicável?

### Social / feed
- [ ] Contadores `post_stats` permanecem consistentes com curtidas/comentários/reposts?
- [ ] Idempotência de posts (quando usada) não foi ignorada?

### Parceiros petshop
- [ ] Slug único e fluxo de onboarding transacional?
- [ ] Guards de painel (`petshopAuthMiddleware`, owner, approval) cobrem as rotas novas?

### Frontend e PWA
- [ ] `header.ejs` carrega `requestCoordinator` antes de `swrCache.js`?
- [ ] Tema dinâmico (`--color-primary`) e `ConfigSistema` não foram quebrados?
- [ ] Service worker / manifest ainda compatíveis com caminhos novos?

### Rate limit e abuso
- [ ] Endpoints sensíveis (auth, ativação, chat público) mantêm limiters apropriados?

### Infra e observabilidade
- [ ] Logs: `logger` em erros de controller/service; DB em queries lentas?
- [ ] Edge Worker: se alterado, `SLOT` e `ORIGIN_BASE_URL` continuam válidos?

## Índice rápido de arquivos-chave

| Arquivo | Função resumida |
|---------|-----------------|
| [package.json](package.json) | Dependências, scripts (`start`, `css:build`, `db:migrate`, `lint`). |
| [server.js](server.js) | Entrypoint que sobe HTTP e aplicação. |
| [src/app.js](src/app.js) | Express + Socket.IO, helmet, sessão, locals, `ConfigSistema`, manifest, health DB, erros. |
| [src/routes/index.js](src/routes/index.js) | Agregador principal de rotas web e `/api/v1`. |
| [src/routes/syncApiRoutes.js](src/routes/syncApiRoutes.js) | Auth mobile + `/api/v1/me*`. |
| [src/middlewares/authMiddleware.js](src/middlewares/authMiddleware.js) | `estaAutenticado`, `estaAutenticadoAPI`, JWT cookie e Bearer. |
| [src/services/authService.js](src/services/authService.js) | Registro, login, JWT, refresh mobile. |
| [src/config/session.js](src/config/session.js) | Sessão PostgreSQL (`user_sessions`). |
| [src/config/database.js](src/config/database.js) | Pool `pg`, `query`, transações, slow query log. |
| [src/config/migrationBaselineStatements.js](src/config/migrationBaselineStatements.js) | Schema baseline (tabelas, triggers). |
| [eslint.config.cjs](eslint.config.cjs) | SQL só em `models`. |
| [tailwind.config.js](tailwind.config.js) | `content` EJS/JS, cores `primary`/`accent`, fonte Inter. |
| [src/public/css/design-system.css](src/public/css/design-system.css) | Tokens CSS e componentes base. |
| [src/views/partials/header.ejs](src/views/partials/header.ejs) | CSS, tema dinâmico, scripts globais (coordinator, SWR, offline). |
| [src/public/js/airpet/requestCoordinator.js](src/public/js/airpet/requestCoordinator.js) | Fila, dedupe, prioridade, métricas. |
| [src/public/js/airpet/swrCache.js](src/public/js/airpet/swrCache.js) | SWR + localStorage + integração coordinator. |
| [src/controllers/syncApiController.js](src/controllers/syncApiController.js) | ETag, `patchMe`, idempotência. |
| [src/utils/logger.js](src/utils/logger.js) | Logger e request logger. |
| [workers/airpet-edge/src/index.js](workers/airpet-edge/src/index.js) | Durable Object proxy + queue consumer. |
| [workers/airpet-edge/wrangler.toml](workers/airpet-edge/wrangler.toml) | Deploy Worker, bindings, vars. |

*Links relativos assumem raiz do repositório AIRPET.*
