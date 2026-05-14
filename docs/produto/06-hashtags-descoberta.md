# 06 — Hashtags e descoberta

> Fase B — hábito + descoberta. Hashtags são a ponte entre o grafo fechado (pets que sigo) e o universo amplo (todo o catálogo de UGC).

## 1. Problema e oportunidade

O grafo "seguir pet" é íntimo mas finito. Para que o usuário não esgote conteúdo em 5 minutos, precisa de uma **superfície de exploração temática** — o equivalente de "Explore" do Instagram ou "FYP" do TikTok.

Hashtags entregam isso com custo baixo:

- O próprio usuário gera o índice (escrevendo `#goldenretriever`).
- Hashtags casam naturalmente com **desafios** (uma hashtag oficial por semana).
- Casam com **localidade** (`#petbh`, `#petsp`) e **espécie** (`#gato`, `#furao`).
- Permitem ao usuário **seguir um interesse** sem seguir contas.

## 2. O que já existe (refs)

| Capacidade | Onde |
|------------|------|
| Texto de posts com `texto`, `legenda` | `publicacoes` em [`migrationBaselineStatements.js`](../../src/config/migrationBaselineStatements.js) |
| Extração de menções (regex) | `PostMention.extrairMencoes` em [`src/controllers/explorarController.js`](../../src/controllers/explorarController.js) |
| Pool de candidatos para feed | `feed_candidate_pool` (segmento ex: `city:PARACATU`, `species:dog`) |
| Perfil de interesse | `user_interest_profile` (espécie/raça com score) |
| Painel de explorar | [`src/routes/explorarRoutes.js`](../../src/routes/explorarRoutes.js) |

Não existe ainda nenhuma tabela `hashtags`, `post_hashtags` ou `hashtag_follows`.

## 3. Spec funcional

### 3.1. Modelo de dados

```sql
CREATE TABLE hashtags (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  nome_exibicao VARCHAR(80) NOT NULL,
  uso_count BIGINT NOT NULL DEFAULT 0,
  ultima_atividade TIMESTAMP,
  oficial BOOLEAN NOT NULL DEFAULT false,
  bloqueada BOOLEAN NOT NULL DEFAULT false,
  data_criacao TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hashtags_uso ON hashtags (uso_count DESC) WHERE bloqueada = false;
CREATE INDEX idx_hashtags_atividade ON hashtags (ultima_atividade DESC) WHERE bloqueada = false;

CREATE TABLE post_hashtags (
  publicacao_id INTEGER NOT NULL REFERENCES publicacoes(id) ON DELETE CASCADE,
  hashtag_id BIGINT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publicacao_id, hashtag_id)
);

CREATE INDEX idx_post_hashtags_hashtag ON post_hashtags (hashtag_id, criado_em DESC);

CREATE TABLE hashtag_follows (
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  hashtag_id BIGINT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, hashtag_id)
);

CREATE INDEX idx_hashtag_follows_user ON hashtag_follows (user_id);
```

### 3.2. Extração e normalização

- Regex única em utilitário: `/#([a-zA-Z0-9_\u00C0-\u017F]{2,50})/g`.
- Normalização: lowercase, strip de acentos para `slug`; preservar `nome_exibicao` original.
- Disparada no **publish** de `publicacoes` e `stories`: upsert em `hashtags` (incrementa `uso_count`, atualiza `ultima_atividade`) e cria rows em `post_hashtags`.
- Limite: máximo 10 hashtags por post (rejeitar excedentes silenciosamente).

### 3.3. Composer de post

- Autocomplete ao digitar `#` — sugere hashtags existentes ordenadas por `uso_count` recente.
- Quando o usuário cria uma hashtag inédita, microcopy "Você criou uma hashtag nova" (reforça pertencimento).

### 3.4. Página da hashtag (`/h/:slug`)

```
[capa editorial se oficial]
#goldenretriever
[N posts] [N pessoas seguem]
[CTA: Seguir hashtag] [CTA secundário: Postar com esta hashtag]

[abas]
Recentes  |  Em alta  |  Pets desta hashtag
```

- **Recentes**: ordem cronológica reversa.
- **Em alta**: `post_engagement_agg.engagement_score` × recência. Reutiliza pipeline do feed.
- **Pets desta hashtag**: agrupar `publicacoes.pet_id` mais frequentes nos últimos 30 dias — vira lista de pets para seguir.

### 3.5. Feed "Hashtags que sigo"

Nova entrada no Explorar:

```
Aba Explorar
  Em alta (curadoria editorial + score)
  Para você (sugestões via user_interest_profile)
  Hashtags que sigo  ← novo
  Mapa social
```

Conteúdo: união de `publicacoes` com hashtag em `hashtag_follows.user_id = me`, ordenado por engajamento.

### 3.6. Integração com `feed_candidate_pool`

A tabela atual indexa candidates por segmento simples (`species:dog`, `city:PARACATU`). Estender para hashtags:

- Worker popula segmentos `hashtag:goldenretriever`.
- Feed de hashtag em alta busca diretamente dali em O(1) com `base_score` calculado.

Sem nova coluna — apenas convenção de prefixo.

### 3.7. Hashtags oficiais (curadoria)

- Admin marca `oficial = true` (desafio da semana, campanha de marca com selo claro).
- Hashtag oficial ganha:
  - Capa editorial.
  - Aparece em "Em alta" mesmo com volume menor.
  - Selo visual ("oficial AIRPET" ou "desafio").

### 3.8. Moderação

- Hashtag bloqueada (`bloqueada = true`) por palavrão ou tema sensível: posts ainda usam, mas não indexam em descoberta e não aparecem no autocomplete.
- Lista negra inicial seedada em migration (palavrões pt-BR + termos sensíveis).
- Denúncia de hashtag inteira disponível a partir da página `/h/:slug`.

## 4. Métricas de sucesso

- **% DAU que abre pelo menos 1 página de hashtag**: meta ≥ 20%.
- **Hashtags seguidas por usuário em D14**: meta ≥ 3.
- **% posts criados com pelo menos 1 hashtag**: meta 40%.
- **Tempo de sessão na aba Explorar**: subir ≥ 15% após lançamento.

## 5. Riscos e anti-padrões

- **Hashtags vazias no MVP** — explore morto. Lançar **só depois** de "seguir pet" estável e de desafios ativos por ≥ 3 semanas (massa crítica).
- **Permitir hashtags com 1 caractere ou só números** — vira spam. Regex mínima 2 caracteres alfanuméricos.
- **Spammar hashtags trending sem relação** (`#viral #lindo #fofo` em qualquer post). Penalizar posts com 10/10 hashtags genéricas no ranking de descoberta.
- **Hashtags geo sem precisão** — `#brasil` engloba tudo. Sugerir hashtags locais no composer baseadas em `usuarios.cidade`.
- **Falsa hashtag "oficial"** — só admin marca; usuário não pode pedir auto-promoção.

## 6. Entrega faseada

| Sprint | Entrega | Critério de pronto |
|--------|---------|--------------------|
| 1 | Tabelas `hashtags`, `post_hashtags`, `hashtag_follows` + migration de seed (palavrões bloqueados) | Estrutura pronta |
| 1 | Extração no publish (publicações e stories) | Hashtags indexadas automaticamente |
| 2 | Página `/h/:slug` com abas Recentes / Em alta | Open Graph para share |
| 2 | Autocomplete no composer | Sugestões pelos top 10 por uso recente |
| 3 | Botão "Seguir hashtag" + feed "Hashtags que sigo" | Ordenação por engajamento |
| 3 | Integração com `feed_candidate_pool` via segmento `hashtag:*` | Worker popula segmentos |
| 4 | Hashtags oficiais + capa editorial | Admin configura via painel; seleção visível em "Em alta" |
