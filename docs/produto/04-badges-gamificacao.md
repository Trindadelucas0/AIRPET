# 04 — Badges visíveis e gamificação

> Fase A — fundação viral. Dados existem no banco há tempo. Falta superfície de exibição e amarração comportamental.

## 1. Problema e oportunidade

Tabelas de gamificação já estão no esquema mas **não aparecem em lugar nenhum** para o usuário. Isso é desperdício duplo: já houve custo de modelagem, e a mecânica seria barata de ativar visualmente. Bem-feito, badges:

- Reforçam comportamentos que **geram conteúdo** (postar, completar desafio, ganhar seguidores).
- Criam **status** social barato (sem dinheiro envolvido).
- Amplificam outras features (desafios → badge "Vencedor da semana"; mapa → badge "Explorador").

Mal-feito, viram poluição visual estilo "achievement unlocked" sem sentido.

## 2. O que já existe (refs)

| Capacidade | Onde |
|------------|------|
| Tabela `user_gamification` (xp, nível, streak, creator_score) | [`migrationBaselineStatements.js`](../../src/config/migrationBaselineStatements.js) (linha 1372) |
| Catálogo `badges` (code, name, icon) | mesmo arquivo (linha 1384) |
| Posse `user_badges` (unique por user+badge) | mesmo arquivo (linha 1393) |
| **Único badge emitido hoje**: `pet_verificado` (ao ativar tag NFC) | [`src/models/NfcTag.js`](../../src/models/NfcTag.js) (linha 252) |
| Snapshot de scores | `post_score_snapshot`, `user_relationship_strength`, `post_engagement_agg` |

Importante: o catálogo `badges` **não tem nenhuma linha seedada**. `pet_verificado` é referenciado por código mas só funciona se houver row em `badges` com `code='pet_verificado'`. **Gap silencioso** — verificar se está sendo populado por migration externa; senão criar seed.

## 3. Spec funcional

### 3.1. Catálogo de badges (MVP)

Cinco categorias, cada uma alimenta um comportamento.

| Code | Nome | Categoria | Como ganha | Amplifica |
|------|------|-----------|------------|-----------|
| `pet_verificado` | Pet Verificado | Confiança | Ativar tag NFC | Selo no avatar |
| `primeiro_post` | Estreia | Onboarding | Primeira `publicacao` | Cold start |
| `posta_7_dias` | Rotina | Hábito | 7 dias seguidos com post (streak) | Stories |
| `pet_popular` | Pet Popular | Status | Pet atinge 100 seguidores | Seguir pet |
| `pet_em_alta` | Em Alta | Status | Top 5% velocidade de seguidores em 7d na cidade | Descoberta |
| `explorador` | Explorador | Mapa | 5 check-ins em locais distintos | Mapa social |
| `vencedor_desafio` | Vencedor (`<semana>`) | Conquista | Vencer um desafio semanal | Desafios |
| `padrinho` | Padrinho | Social | Convidar 3 amigos que postaram | Viralização |
| `pet_do_mes` | Pet do Mês — (`<mês>`) | Prestígio | Vencer pet do mês | Pet do mês |

`name` e `description` armazenados em pt-BR no `badges`. Para internacionalizar futuramente, criar tabela `badge_translations` (não MVP).

### 3.2. Modelagem de badges vinculados ao **pet** (não só ao tutor)

Hoje `user_badges` referencia `user_id`. Mas badges como `pet_popular` ou `pet_do_mes` são propriedade **do pet**, não do tutor. Adicionar:

```sql
ALTER TABLE user_badges
  ADD COLUMN IF NOT EXISTS pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contexto VARCHAR(50);  -- ex: '2026-01' para pet do mês de janeiro

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_unique_pet
  ON user_badges (user_id, badge_id, COALESCE(pet_id, 0), COALESCE(contexto, ''));
```

Regra: se badge é de pet, `pet_id` é obrigatório; se é de usuário, `pet_id` é nulo.

### 3.3. Onde aparecem

**No perfil do pet (`/p/:slug`):**

- Vitrine horizontal de até 6 badges no header (abaixo da bio).
- Tocar badge → modal "Como conquistar".

**No perfil do tutor:**

- Strip horizontal com badges do tutor + agregado "X badges em meus pets".

**No card de pet (no feed e em listas):**

- Apenas o badge mais valioso visível (ex.: `pet_do_mes`); resto fica no perfil.

**No header dos posts:**

- Pequeno selo ao lado do nome do pet quando ele tem `pet_em_alta` ativo.

### 3.4. Hierarquia visual

```
prestígio (raro)        cor primária + brilho     pet_do_mes
status (popular)        cor primária              pet_popular, pet_em_alta
conquista               cor secundária            vencedor_desafio
confiança               cor neutra                pet_verificado
hábito                  cor neutra                posta_7_dias, primeiro_post
```

### 3.5. Concessão automática (workers)

Job diário existente (ver `cron_execucoes`) deve incluir:

```
- Atualizar user_gamification.streak_days e last_activity_date.
- Verificar marcos de seguidores e conceder pet_popular.
- Calcular velocidade de seguidores 7d por cidade e conceder pet_em_alta (e revogar quando sai do top).
- Emitir vencedor_desafio ao fechar desafio da semana (ver spec 05).
- Emitir pet_do_mes ao consolidar votação (ver spec 07).
```

Badges efêmeros (`pet_em_alta`) devem ter `expira_em` opcional para revogação automática:

```sql
ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS expira_em TIMESTAMP;
```

### 3.6. Anti-abuso

- Streak não conta posts deletados em até 24h (evita farm).
- `pet_popular` requer ≥ 50% dos seguidores serem contas com ao menos 1 post (anti-bot).
- `padrinho` exige que os 3 amigos convidados publiquem ao menos 1 post em até 14 dias.

## 4. Métricas de sucesso

- **% de tutores com ≥ 1 badge visível em D14**: meta ≥ 60%.
- **CTR no modal "Como conquistar" abrindo a partir de badge alheio**: meta ≥ 20% (significa que badge inspira ação).
- **Correlação badges visíveis ↔ frequência semanal**: deve ser positiva. Se neutra ou negativa em 30 dias, revisar catálogo.

## 5. Riscos e anti-padrões

- **Diluir badges criando dezenas no MVP.** Manter ≤ 10 inicialmente; cada novo badge precisa justificar comportamento que amplifica.
- **Mostrar XP/nível como número grande.** Inflar status sem narrativa empobrece. Manter XP discreto (só na tela de perfil próprio, "barra de progresso para próximo nível"); badges são a unidade pública.
- **Badge desbloqueado sem feedback emocional.** Cada concessão deve disparar push leve + animação no perfil. Sem isso, dado morre.
- **Permitir comprar badge.** Quebra o sistema inteiro. Política: badges só por comportamento.
- **`pet_verificado` sem catálogo seedado.** Verificar se `badges` tem row para `pet_verificado`; criar migration de seed se faltar.

## 6. Entrega faseada

| Sprint | Entrega | Critério de pronto |
|--------|---------|--------------------|
| 1 | Migration de seed do catálogo `badges` (9 entradas + ícones) | `SELECT count(*) FROM badges` ≥ 9 |
| 1 | Coluna `pet_id`, `contexto`, `expira_em` em `user_badges` | Index único composto funciona |
| 2 | Vitrine de badges no perfil pet e tutor | Até 6 visíveis, modal "como conquistar" |
| 2 | Concessão automática de `primeiro_post`, `posta_7_dias`, `pet_popular` | Worker diário emite e loga |
| 3 | `pet_em_alta` com revogação por TTL | Reaparece dinamicamente |
| 4 | Push de concessão + animação | A/B confirma engagement ≥ +10% no D+1 |
