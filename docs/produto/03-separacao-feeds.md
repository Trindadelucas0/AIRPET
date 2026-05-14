# 03 — Separação de feeds (Pets x Parceiros)

> Fase A — fundação viral. Regra de ouro: **nunca** intercalar conteúdo comercial no scroll emocional.

## 1. Problema e oportunidade

A diferença entre Instagram (alta qualidade percebida) e qualquer rede que afundou (catálogo virou social, social virou catálogo) está no respeito ao **contrato implícito** com o usuário: quando ele rola o feed para ver pets, **ele não está comprando nada**. Misturar promoção quebra confiança e mata retenção.

O backend já reflete essa separação no esquema:

- Conteúdo emocional vive em [`publicacoes`](../../src/config/migrationBaselineStatements.js) (linha 850).
- Conteúdo comercial vive em [`petshop_posts`](../../src/config/migrationBaselineStatements.js) (linha 1582) e `petshop_products`.

Falta materializar essa separação na arquitetura visual e no produto.

## 2. O que já existe (refs)

| Capacidade | Onde |
|------------|------|
| Feed social (posts de pet) | `publicacoes`, `post_media`, `post_stats` |
| Feed comercial (parceiros) | `petshop_posts` e `petshop_products` com `is_highlighted` |
| Limite anti-spam comercial | Trigger `fn_petshop_products_limit` (máx 15 ativos por petshop) em [`migrationBaselineStatements.js`](../../src/config/migrationBaselineStatements.js) |
| Painel parceiro | [`src/routes/petshopPanelRoutes.js`](../../src/routes/petshopPanelRoutes.js) |
| Discovery/explorar atual | [`src/controllers/explorarController.js`](../../src/controllers/explorarController.js) |
| Aprovação de posts comerciais | `approval_status` em `petshop_posts` |

## 3. Spec funcional

### 3.1. Arquitetura visual (navegação)

A bottom tab bar (mobile-first) deve refletir os **dois produtos**:

```
[ Pets ]   [ Explorar ]   [ + Postar ]   [ Parceiros ]   [ Perfil ]
emocional  descoberta     criação        comercial       eu
```

Regras:

- **Pets** (`/feed`): apenas `publicacoes`. Nunca `petshop_posts`.
- **Explorar**: descoberta de pets, hashtags, mapa. Pode conter **1 banner editorial** de parceiro local com badge "Patrocinado" claramente identificado, sempre com botão dismiss. Máximo 1 a cada 10 cartões.
- **Parceiros**: feed dedicado de `petshop_posts` e ofertas — aqui é onde o usuário **vai por conta própria** quando quer ofertas.
- **Perfil**: meu eu + meus pets.

### 3.2. Regra de ouro (não-negociável)

```
NUNCA injetar petshop_posts ou petshop_products no scroll de /feed (aba Pets).
```

Justificativa: cada vez que o usuário rola e encontra promoção em meio a fotos íntimas do pet do amigo, a percepção de qualidade despenca. Esse padrão fez Facebook perder relevância orgânica em 2014–2018 e Instagram contemplar "back to roots" em 2024.

### 3.3. Onde o comercial pode aparecer (entradas controladas)

| Local | Formato | Frequência |
|-------|---------|------------|
| Aba **Parceiros** | Feed pleno de petshop_posts + ofertas | Sem limite (é a casa do comercial) |
| Aba **Explorar** | 1 card "perto de você" no topo, dismissable | 1 por sessão |
| Aba **Mapa** | Pins de petshop em camada separada (toggle) | Padrão off na primeira sessão |
| Perfil de pet logado | Banner "tutor é parceiro" (se aplicável) | 1 por perfil |
| Notificação push | Promoções **só** se usuário optou em "receber ofertas de parceiros próximos" | Opt-in explícito |

### 3.4. Linguagem visual

- Cards de pet: cantos arredondados grandes, foto dominante, sem badge "promoção".
- Cards de parceiro: badge `Parceiro` ou `Oferta` visível, cor diferente do tema social (cor secundária da marca AIRPET), CTA explícito "Ver oferta".
- **Sem mimetização**: parceiros não podem se passar por pets. Avatar de parceiro tem moldura quadrada (vs circular para pet).

### 3.5. Composição de timeline na aba Pets

Ordem do feed `/feed`:

1. Posts de pets que sigo (cronológico recente nos primeiros 20).
2. Recomendações editoriais — **só pets** vindas de `feed_candidate_pool` (segmentos `species:` e `city:`).
3. Reposts de pets seguidos.

Nunca há um item de origem `petshop_posts` ou `petshop_products` nessa lista.

### 3.6. API contract

| Endpoint | Origem de dados | Anti-mistura |
|----------|-----------------|--------------|
| `GET /api/feed` | `publicacoes` + `post_stats` + `feed_candidate_pool` | Filtrar `source_type IN ('post')` |
| `GET /api/parceiros/feed` | `petshop_posts` + `petshop_products` | Apenas comercial |
| `GET /api/explorar` | Mix curado (pets + 1 card parceiro opcional) | Card parceiro vem em campo `sponsored` separado, não no array `posts` |

Resposta do explorar:

```json
{
  "posts": [{...pet posts...}],
  "sponsored": { "type": "petshop_post", "id": 123, "dismissable": true },
  "cursor": "..."
}
```

O cliente decide se renderiza `sponsored` no slot fixo (não inline no array).

## 4. Métricas de sucesso

- **% sessions com scroll > 10 cartões em /feed**: meta +20% após separação rígida.
- **NPS pergunta "AIRPET é uma rede social ou um marketplace?"**: 80%+ dos usuários ativos devem responder "rede social".
- **CTR em cards de parceiro na aba Explorar**: meta 3–6% (saudável). Acima de 10% indica mistura excessiva; abaixo de 1% indica formato errado.
- **Sessions abrindo aba Parceiros explicitamente**: meta 25% dos DAU (significa que comercial tem casa própria com tráfego orgânico).

## 5. Riscos e anti-padrões

- **Pressão comercial de parceiros pedindo "1 post a cada 5 no feed principal".** Resistir; oferecer alternativa: destaque editorial pago **só** na aba Explorar.
- **Esconder o badge "Parceiro" para aumentar CTR.** Quebra confiança. Sempre visível.
- **Notificações push de parceiros sem opt-in.** Risco regulatório (CDC) e churn imediato.
- **Permitir parceiro criar conta de pet falsa para postar no feed social.** Política de TOS clara + detecção (CNPJ vinculado a conta sem pet real).
- **"Stories patrocinados" no MVP.** Não. Adiar até a Fase C, e mesmo assim com regras (próximo doc).

## 6. Entrega faseada

| Sprint | Entrega | Critério de pronto |
|--------|---------|--------------------|
| 1 | Bottom tab bar com 5 itens (Pets, Explorar, +, Parceiros, Perfil) | Navegação consistente em todas as telas autenticadas |
| 1 | `GET /api/feed` garantidamente sem `petshop_*` | Teste automatizado que falha se aparecer registro comercial |
| 2 | `GET /api/parceiros/feed` e tela da aba | Feed paginado, busca por cidade, filtro por categoria |
| 2 | Card "patrocinado" no Explorar (1/sessão, dismissable) | Campo `sponsored` separado na resposta |
| 3 | Política de TOS pública sobre conta de pet falsa | Página `/termos` atualizada e endpoint de denúncia |
| 3 | Opt-in para notificações de parceiros | Configuração default OFF |
