# 05 — Stories 24h (Diário do Pet) e desafios semanais

> Fase B — hábito diário. Sem ritual, retenção é puramente reativa. Estes dois sistemas geram os picos de uso.

## 1. Problema e oportunidade

Redes sociais bem-sucedidas têm um **motivo recorrente** para o usuário abrir o app **hoje**. Instagram tem stories. Strava tem o desafio mensal. BeReal tem o ping diário.

AIRPET tem o pet — que naturalmente produz **rotina visual diária** (acordar, brincar, comer, passear, dormir). Faltam dois mecanismos:

1. **Stories 24h ("Diário do Pet")** — postagens leves, efêmeras, frequentes.
2. **Desafios semanais** — tema editorial, hashtag oficial, ranking interno.

O ganho combinado: **frequência** (stories) + **direcionamento** (desafios) → fluxo orgânico de UGC com tema.

## 2. O que já existe (refs)

| Capacidade | Onde |
|------------|------|
| Posts duradouros (`publicacoes`) com mídia, menções, marcações | [`migrationBaselineStatements.js`](../../src/config/migrationBaselineStatements.js) (linha 850) |
| `diario_pet` (existe **mas é log de cuidados**, não story) | mesmo arquivo (linha 1168) — alimentação, passeios, valores numéricos |
| Idempotência de criação | `post_idempotency_keys` |
| Pipeline de mídia | `post_media`, [`persistUploadMiddleware`](../../src/middlewares/persistUploadMiddleware.js) |

**Atenção**: a tabela `diario_pet` atual **não é** o "Diário do Pet" deste spec. Apesar do nome colidir, ela é log estruturado de cuidados (vacinas, alimentação). Decidir uma das duas opções:

- **Opção A (recomendada)**: criar nova entidade `stories` separada de `diario_pet`. Mantém domínios limpos.
- Opção B: renomear `diario_pet` → `cuidados_pet` e usar o nome `diario_pet` para stories. Mais limpo conceitualmente, custo de migração maior.

Este spec assume **opção A**.

## 3. Spec funcional — Stories ("Diário do Pet")

### 3.1. Modelo de dados

```sql
CREATE TABLE stories (
  id BIGSERIAL PRIMARY KEY,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  autor_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10) NOT NULL DEFAULT 'image',  -- 'image' | 'video'
  duracao_ms INTEGER,                                -- só para vídeo
  legenda VARCHAR(280),
  stickers JSONB,                                    -- array de stickers (mention, hashtag, desafio)
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  visivel BOOLEAN NOT NULL DEFAULT true,
  reportado BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_stories_pet_ativo ON stories (pet_id, expira_em) WHERE visivel = true;
CREATE INDEX idx_stories_expira ON stories (expira_em);

CREATE TABLE story_views (
  story_id BIGINT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  visto_em TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, user_id)
);
```

Worker diário marca `visivel = false` quando `expira_em < NOW()`. Não deletar — manter por 30 dias para denúncias e moderação.

### 3.2. UX

**Strip no topo do feed `/feed`**:

```
[Meu pet] [Pet A] [Pet B] [Pet C] [Desafio +]
   +         •      •       •
```

- Avatares circulares com **anel colorido** quando há story não visto.
- Primeiro slot é "Meu pet" (CTA para criar).
- Último slot fixo é o desafio da semana (entra ao tocar).

**Tela de criação (fluxo de 3 toques)**:

1. Câmera ou galeria → seleção.
2. Edição rápida — sticker de hashtag, menção, "participar do desafio".
3. Publicar → push leve "Seu story foi para o ar".

**Tela de visualização** (full-screen, gestos):

- Tap direito: próximo story do mesmo pet.
- Tap esquerdo: voltar.
- Swipe down: fechar.
- Swipe up: responder via DM ao tutor (cria conversa em `conversas`).

### 3.3. Privacidade

- Padrão: stories visíveis para todos (mesma política do perfil do pet).
- Se pet é `privado`, stories só para seguidores aceitos.
- Story pode ter visibilidade limitada a "**Próximos amigos**" (campo extra em fase 2). Não MVP.

### 3.4. Anti-spam

- Máximo **20 stories por pet em 24h**. Acima disso, bloquear UI e retornar 429.
- Detecção de conteúdo idêntico (hash da mídia): rejeita re-upload em janela de 24h.

### 3.5. Métricas no story

- **Quem viu** (lista de `story_views` para o tutor).
- Total de views.
- Não exibir likes em stories — fricção desnecessária. Reação opcional (até 3 emojis pré-definidos) entra na fase 2.

## 4. Spec funcional — Desafios semanais

### 4.1. Modelo de dados

```sql
CREATE TABLE desafios (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(60) UNIQUE NOT NULL,                  -- 'pet-dormindo-2026-w19'
  titulo VARCHAR(120) NOT NULL,                       -- "Poste seu pet dormindo"
  descricao TEXT,
  hashtag VARCHAR(50) NOT NULL,                       -- 'petdormindo'
  inicia_em TIMESTAMP NOT NULL,
  termina_em TIMESTAMP NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'rascunho',     -- rascunho|ativo|encerrado
  capa_url TEXT,
  criado_por_admin INTEGER REFERENCES usuarios(id),
  data_criacao TIMESTAMP DEFAULT NOW()
);

CREATE TABLE desafio_participacoes (
  id BIGSERIAL PRIMARY KEY,
  desafio_id INTEGER NOT NULL REFERENCES desafios(id) ON DELETE CASCADE,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  autor_user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  publicacao_id INTEGER REFERENCES publicacoes(id) ON DELETE CASCADE,
  story_id BIGINT REFERENCES stories(id) ON DELETE CASCADE,
  score NUMERIC(12,4) DEFAULT 0,
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE (desafio_id, COALESCE(publicacao_id, 0), COALESCE(story_id, 0))
);

CREATE INDEX idx_desafio_participacoes_desafio ON desafio_participacoes (desafio_id, score DESC);
```

### 4.2. Fluxo

- **Curadoria**: admin cria 1 desafio toda segunda-feira via painel. Tema rotativo (visual, humor, rotina). Lista de exemplos: "Pet dormindo", "Pet desconfiado", "Pet de filhote", "Pet brincando", "Selfie com o tutor", "Cor do pet hoje".
- **Entrada de criação**:
  - Aba Pets: card editorial no topo (1x ao iniciar a semana).
  - Composer de post/story tem opção "Participar do desafio: <título>".
- **Hashtag automática**: ao participar, hashtag oficial `#<hashtag>` é anexada e bloqueada de edição.
- **Ranking**: ordenado por `score` = likes + 3×comentários + 5×reposts (calculado pelo worker, semelhante a `post_engagement_agg`).
- **Encerramento (domingo 23:59)**:
  - Top 3 ganham badge `vencedor_desafio` com `contexto='<slug>'`.
  - Tela "Resultado da semana" com vencedores, compartilhável.
  - Notificação push para todos os participantes com sua posição.

### 4.3. Anti-abuso

- 1 participação por pet por desafio (`UNIQUE` no schema).
- Conta criada há menos de 24h não pode participar (anti-bot).
- Score conta apenas likes/comments **de contas com ≥ 1 post próprio** (filtra inflar via contas vazias).

### 4.4. Reuso por hashtag

- Ver [spec 06](./06-hashtags-descoberta.md). Cada desafio é uma hashtag "promovida". Após encerrar, hashtag permanece navegável e marcada como "ex-desafio".

## 5. Métricas de sucesso

### Stories
- **Stories postados por DAU**: meta ≥ 0.6.
- **% DAU que vê pelo menos 1 story**: meta ≥ 55%.
- **Tempo médio na sessão**: deve subir após lançamento (proxy de hábito).

### Desafios
- **% pets ativos que participam do desafio na semana**: meta ≥ 15%.
- **% sessões que abrem o card do desafio**: meta ≥ 30%.
- **Reposts/share externo da tela "Resultado da semana"**: meta ≥ 5% dos visualizadores.

## 6. Riscos e anti-padrões

- **Permitir story → vira igual a post.** Os stories devem ser intencionalmente **mais leves** (1 mídia, sem múltipla galeria no MVP, edição rápida).
- **Desafios genéricos demais.** "Poste seu pet" não puxa criatividade. Sempre verbo + cena ("dormindo", "olhando feio").
- **Não anunciar o vencedor.** Mata a próxima participação. Resultado deve virar conteúdo orgânico (push + card compartilhável).
- **Manter "diario_pet" e "stories" com o mesmo nome em UI.** Confusão. Renomear UI atual para "Cuidados do Pet" e usar "Diário do Pet" só para stories.
- **Stories sem denúncia.** Risco legal. Botão "Denunciar" no overflow desde o MVP, marcando `reportado = true` e ocultando se 2+ denúncias.

## 7. Entrega faseada

| Sprint | Entrega | Critério de pronto |
|--------|---------|--------------------|
| 1 | Renomear UI `diario_pet` → "Cuidados do Pet" (sem migração de schema) | Sem string "Diário do Pet" referenciando log de cuidados |
| 1 | Tabelas `stories`, `story_views` + worker de expiração | TTL respeitado, índice eficaz |
| 2 | Strip de stories no `/feed` + viewer full-screen | Gestos funcionam em iOS e Android (PWA) |
| 2 | Composer de story (foto/vídeo curto, sticker básico) | 3 toques para publicar |
| 3 | Tabelas `desafios`, `desafio_participacoes` + painel admin | Admin cria desafio com slug/hashtag |
| 3 | Card editorial do desafio no topo do feed + opção "Participar" no composer | Hashtag oficial auto-anexada |
| 4 | Worker de score + emissão de badge `vencedor_desafio` | Top 3 recebem badge ao encerrar |
| 4 | Tela "Resultado da semana" com share externo | OG card pronto para WhatsApp e Instagram |
