# Tutorial — demo social (hashtag, pet do mês, grupos, stories)

Este guia explica **como abrir no app (web AIRPET)** as rotas de demonstração e o que foi semeado no banco.

## 1. Aplicar dados de teste no PostgreSQL

Os dados demo vêm da migration **`1776220000000_seed_social_demo_hashtags_grupo_votos.mjs`** (e das migrations anteriores que criam tabelas `hashtags`, `grupos`, `pet_do_mes_*`, etc.).

No diretório do projeto, com `.env` apontando para o banco:

```bash
npm run db:migrate
```

O que essa migration tenta criar (idempotente):

| Dado | Detalhe |
|------|---------|
| Hashtags | `airpetdemo` e `petdormindo` |
| Post na hashtag | Liga a hashtag **`airpetdemo`** à **publicação mais recente** que tenha `pet_id` (se existir alguma) |
| Grupo | `pets-do-airpet` — nome “Pets do AIRPET” |
| Voto demo | Um voto na edição **Pet do mês** do mês atual, usando o **primeiro usuário** e o **primeiro pet** do banco (se existirem) |

Se ainda não houver **nenhuma** `publicacoes` com pet, a página `/h/airpetdemo` abre com **0 posts** (mas a hashtag existe). Publique um post no feed com `#airpetdemo` na legenda para aparecer ali.

## 2. Onde clicar no app (fluxo web)

Use o mesmo host em que o servidor roda (ex.: `http://localhost:3000`). **Faça login** para rotas que exigem sessão.

### Hashtag pública (sem login para ver)

1. Abra no navegador: **`/h/airpetdemo`**
2. Você vê a lista de posts com essa hashtag (se houver vínculo no seed ou posts seus).
3. Para **seguir** a hashtag: clique em **Entrar**, faça login, volte à mesma URL e use **“Seguir hashtag”**.

Rotas:

- `GET /h/airpetdemo` — página
- `POST /h/airpetdemo/seguir` — seguir (logado)
- `DELETE /h/airpetdemo/seguir` — deixar de seguir (logado)

### Pet do mês

1. Com login, abra **`/explorar/pet-do-mes`** (ou use o link **“Pet do mês”** na barra lateral do **Feed** `/feed`).
2. Escolha um pet **seu** ou que **você segue** no select e envie o voto.

Rota de API usada pelo formulário:

- `POST /explorar/pet-do-mes/votar` — corpo JSON `{ "pet_id": <número> }`

### Grupos

1. Logado, abra **`/explorar/grupos`** (ou o link **“Grupos”** na lateral do `/feed`).
2. No grupo **“Pets do AIRPET”**, clique em **Entrar**.

Rota:

- `POST /explorar/grupos/pets-do-airpet/entrar`

### Stories (tempo para passar)

1. Abra **`/feed`** (aba **Pets**).
2. Na faixa **Stories**, publique com **+ Novo** ou toque numa bolha.
3. No visualizador: a barra branca no topo enche em **6 segundos** e passa para o **próximo** story da fila; toque na **esquerda** para voltar / fechar no primeiro; toque na **direita** ou espere para avançar; **Esc** fecha.

## 3. Se algo “não funcionar”

| Sintoma | O que conferir |
|---------|----------------|
| 404 na hashtag | Rode `npm run db:migrate` e use slug **`airpetdemo`**. |
| Botão seguir hashtag não muda | Precisa estar **logado** na mesma origem (mesmo host/porta). O fetch envia `Accept: application/json` para receber JSON em vez de redirect HTML. |
| Grupos vazios | Migration do grupo (`177621` ou `177622`) não aplicada ou slug diferente — use **`pets-do-airpet`**. |
| Voto recusado | Só vale para pet **seu** ou que **você segue**; veja mensagem em vermelho na página. |

## 4. Referência rápida de URLs

| URL | Autenticação |
|-----|----------------|
| `/h/airpetdemo` | Não (só ver) |
| `/explorar/pet-do-mes` | Sim |
| `/explorar/grupos` | Sim |
| `/feed` | Sim (stories + composer) |

Documentação de produto relacionada: [06 — Hashtags](./06-hashtags-descoberta.md), [07 — Pet do mês, mapa, grupos](./07-prestigio-mapa-grupos.md), [05 — Stories](./05-stories-desafios.md).
