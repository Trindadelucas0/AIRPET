# 01 — Perfil do pet como personalidade

> Fase A — fundação viral. Sem perfil rico, "seguir pet" vira gimmick.

## 1. Problema e oportunidade

Hoje o pet é tratado como **registro cadastral** (espécie, raça, microchip, status). Para virar rede social, precisa ser tratado como **personagem público com voz própria**: o usuário deve abrir o perfil e sentir que está conhecendo *aquele* cachorro/gato, não consultando uma ficha.

A oportunidade competitiva mora aqui — Instagram tem perfis pessoais; Strava tem perfis de atleta; **AIRPET pode ser o único produto onde o pet é o protagonista de primeira classe**.

## 2. O que já existe (refs)

| Capacidade | Onde |
|------------|------|
| Slug público `/p/:slug` | [`src/models/Pet.js`](../../src/models/Pet.js) (gerador idempotente) e rota em [`src/routes/index.js`](../../src/routes/index.js) (`router.get('/p/:slug', ...)`) |
| Foto e capa | Campos `foto` e `foto_capa` em `pets` ([`migrationBaselineStatements.js`](../../src/config/migrationBaselineStatements.js)) |
| Selo verificado | `tem_tag_ativa` / `verificado` derivados em [`Pet.js`](../../src/models/Pet.js) (`PET_VERIFICATION_FIELDS`) |
| Contador de seguidores | `SeguidorPet.contarSeguidores(petId)` em [`src/models/SeguidorPet.js`](../../src/models/SeguidorPet.js) |
| Posts do pet | Coluna `pet_id` em `publicacoes` (já vincula post a pet) |
| Página pública | [`src/controllers/petPublicController.js`](../../src/controllers/petPublicController.js) renderiza perfil |

## 3. Spec funcional

### 3.1. Anatomia do perfil

```
[capa]
[avatar][nome do pet][selo verificado]
[bio em primeira pessoa, até 160 chars]
[N seguidores] [N posts] [N desafios vencidos]
[CTA primário: Seguir pet] [CTA secundário: Mandar oi]

[Destaques fixados — até 4 posts]
[Grade de posts — todas as publicacoes pet_id=X]
```

### 3.2. Campos a adicionar ao schema

Coluna nova em `pets`:

- `bio_pet VARCHAR(160)` — narrativa em primeira pessoa. Padrão: vazio. Sugestão automática no primeiro preenchimento ("Eu sou o <nome>, um <tipo> <porte>…").

A bio do **tutor** (`usuarios.bio`) já existe e permanece — são vozes separadas (pet vs humano).

### 3.3. CTAs e estados

| Estado do visitante | CTA primário | CTA secundário |
|---------------------|--------------|----------------|
| Anônimo | "Seguir pet" → login modal | "Compartilhar" |
| Logado, não segue | "Seguir pet" | "Mandar oi" (DM ao tutor) |
| Logado, já segue | "Seguindo" (toggle off) | "Mandar oi" |
| Próprio tutor | "Editar perfil" | "Postar agora" |

### 3.4. Métricas públicas (no header)

- Seguidores do pet (não do tutor).
- Posts publicados.
- *Opcional, fase 2*: dias seguidos com post (streak do pet).

### 3.5. Privacidade

- Tutor pode marcar pet como **privado** (`pets.privado BOOLEAN DEFAULT false`). Privado: posts e seguidores só visíveis para quem já segue, e seguir vira pedido.
- Idade exata e microchip nunca aparecem no perfil público — só "X anos" arredondado.

### 3.6. SEO e share

- `<title>` = `"<nome do pet> (@<slug>) — AIRPET"`.
- `og:image` = capa ou foto do pet (1200×630 derivada).
- `og:description` = bio_pet (fallback: "Conheça <nome>, <tipo> no AIRPET").

## 4. Métricas de sucesso

- **Conversão de visita a perfil → seguir**: meta inicial 8% em pets ativos.
- **% de pets com bio_pet preenchida** em D7 após criação: meta 40%.
- **% de pets com pelo menos 1 post fixado**: meta 25% em pets com 10+ posts.

## 5. Riscos e anti-padrões

- **Misturar identidade do tutor e do pet no mesmo header.** O tutor deve aparecer como link discreto ("tutor: @lucas"), não competir com o pet.
- **Bio gerada por IA padrão sem revisão.** Perde personalidade. Sugerir apenas como rascunho editável.
- **Mostrar microchip/endereço público.** Risco de segurança e LGPD.
- **Confundir "verificado" com endossado por marca.** O selo aqui significa "pet possui tag NFC ativa" (`tem_tag_ativa`). Tooltip obrigatório.

## 6. Entrega faseada

| Sprint | Entrega | Critério de pronto |
|--------|---------|--------------------|
| 1 | Adicionar `bio_pet` e `privado` ao schema + form de edição | Tutor consegue editar bio em até 30s |
| 1 | Refatorar header de `/p/:slug` para layout pet-first | Contadores e CTA "Seguir pet" no fold |
| 2 | Destaques fixados (reutilizar `publicacoes.fixada`) | Até 4 destaques por pet |
| 2 | Open Graph / share card | Preview no WhatsApp e Instagram correto |
| 3 | Modo privado (pedidos de seguir) | Fluxo aceitar/recusar em até 2 toques |
