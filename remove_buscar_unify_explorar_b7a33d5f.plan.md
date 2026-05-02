---
name: Remove Buscar Unify Explorar
overview: Remoção completa da funcionalidade de Buscar (/explorar/busca e suas 7 entradas na UI), deixando apenas a página Explorar como superfície única, com ajustes de design após limpeza. Sem alterações no banco de dados.
todos:
  - id: backend
    content: Remover rota /busca em explorarRoutes.js, método paginaBusca no controller, método buscarParaPaginaBuscaExplorar em Usuario.js
    status: pending
  - id: view-busca
    content: Deletar src/views/explorar/busca.ejs
    status: pending
  - id: nav
    content: Remover 3 referências a /explorar/busca em nav.ejs (condição isMaisDestaque, link top nav, link bottom nav Mais)
    status: pending
  - id: feed-view
    content: Remover 2 barras de busca em feed.ejs (mobile e sidebar desktop)
    status: pending
  - id: explorar-view
    content: Remover 4 referências a /explorar/busca em explorar.ejs (barra principal, card sidebar, Ver mais, Buscar pets)
    status: pending
  - id: sw-docs
    content: Bumpar CACHE_VERSION em sw.js para airpet-v10 e remover linha da rota no docs/qa/route-inventory.md
    status: pending
  - id: design-polish
    content: Ajustes finos de espaçamento no header /explorar e sidebar após remoção das barras
    status: pending
  - id: documentar
    content: Registrar a alteração no formato Data/Alteração/Local/Motivo/Impactos/Rollback solicitado
    status: pending
isProject: false
---

## Contexto

- Stack: Node.js + Express 5 + EJS (SSR) + PostgreSQL + Tailwind + Socket.io (PWA).
- Ambiente: local/desenvolvimento, sem usuários em produção.
- Decisão confirmada: remover **completamente** a busca, sem redirect 301.
- Zero mudanças de banco de dados. Zero operações de VPS.

## APIs preservadas (não tocar)

São usadas por menções `@usuario` em posts/comentários fora da página de busca:
- `GET /explorar/api/usuarios` → `explorarController.buscarUsuarios`
- `GET /explorar/api/pets` → `explorarController.buscarPets` → `recomendacaoService.buscarPets`
- `GET /explorar/api/v2/users/search` → `explorarController.buscarUsuariosV2`

## Arquivos afetados (9 arquivos, 0 migrações)

### Backend

**[src/routes/explorarRoutes.js](AIRPET/src/routes/explorarRoutes.js)**
Remover linha 140:
```js
router.get('/busca', explorarController.paginaBusca);
```

**[src/controllers/explorarController.js](AIRPET/src/controllers/explorarController.js)**
Remover método `paginaBusca` (linhas 1516–1550). Nenhum outro caller usa.

**[src/models/Usuario.js](AIRPET/src/models/Usuario.js)**
Remover método `buscarParaPaginaBuscaExplorar` (linha 442). Grep confirma uso único em `paginaBusca`.

### Views

**DELETAR [src/views/explorar/busca.ejs](AIRPET/src/views/explorar/busca.ejs)** (348 linhas, órfão após remoção).

**[src/views/partials/nav.ejs](AIRPET/src/views/partials/nav.ejs)** — remover 3 pedaços:
- Linha 11: tirar `currentPath.startsWith('/explorar/busca') ||` da condição `isMaisDestaque`.
- Linhas 39–41: bloco `<a href="/explorar/busca">` do top nav desktop (ícone lupa "Buscar").
- Linhas 184–187: bloco `<a href="/explorar/busca">` do painel "Mais" do bottom nav mobile.

**[src/views/feed.ejs](AIRPET/src/views/feed.ejs)** — remover 2 pedaços:
- Linhas 684–690: `<div class="lg:hidden"> <a href="/explorar/busca" class="mobile-search">...` (busca mobile).
- Linhas 1051–1057: `<div style="margin-bottom:14px;"> <a href="/explorar/busca" ...>...` (busca sidebar desktop).

**[src/views/explorar.ejs](AIRPET/src/views/explorar.ejs)** — remover 4 pedaços:
- Linhas 228–235: barra de busca principal no header (card branco com lupa "Buscar pets ou pessoas…"). Também apagar o comentário `<!-- Barra de busca única (mobile + desktop) -->` acima.
- Linhas 440–449: card `<div class="explorar-sidebar-card bg-white overflow-hidden p-0">` inteiro, contendo a busca da sidebar desktop.
- Linhas 489–491: `<a href="/explorar/busca">Ver mais</a>` no fim do card "Quem seguir".
- Linhas 526–528: `<a href="/explorar/busca">Buscar pets</a>` no fim do card "Pets populares".

### PWA e documentação

**[src/public/sw.js](AIRPET/src/public/sw.js) linha 17:**
```js
const CACHE_VERSION = 'airpet-v10';
```
(era `airpet-v9`). Isso invalida cache em clients que navegaram para `/explorar/busca` em sessões anteriores.

**[docs/qa/route-inventory.md](AIRPET/docs/qa/route-inventory.md) linha 68:** remover a linha da tabela correspondente a `GET /explorar/busca`.

## Melhorias de UX/UI pós-remoção

1. Header do `/explorar` (linhas 219–227): com a barra fora, apertar o espaçamento vertical do hero para a grade começar mais acima.
2. Sidebar desktop do `/explorar`: "Quem seguir" vira o primeiro card do rail — manter `sticky top-24`.
3. `feed.ejs` mobile: composer sobe para o topo (hierarquia fica mais limpa).
4. Bottom Nav mobile: painel "Mais" fica com 5 itens (Meus Pets, Notificações, Minhas TAGs, Configurações, Meu perfil).

## Riscos e mitigações

- **Cache SW servindo `/explorar/busca`:** bump `CACHE_VERSION` para `airpet-v10`.
- **Quebrar menções `@` se mexer nas APIs erradas:** plano explicita manter `/explorar/api/usuarios`, `/explorar/api/pets`, `/explorar/api/v2/users/search`.
- **Método órfão `buscarParaPaginaBuscaExplorar`:** grep confirmou único caller; seguro remover.

## Rollback (local)

```powershell
git checkout -b feat/remover-busca
# ... aplicar edições ...
git add -A
git commit -m "feat: remove funcionalidade buscar e unifica em explorar"
```

Para reverter: `git reset --hard HEAD~1` ou `git checkout main`.

## Documentação da alteração (registro pós-execução)

Será registrado em `docs/` ou em commit message no formato solicitado:

```
Data: 02/05/2026
Alteração: Remoção da funcionalidade "Buscar" (/explorar/busca e 7 entradas na UI).
Local: src/routes/explorarRoutes.js, src/controllers/explorarController.js,
       src/models/Usuario.js, src/views/partials/nav.ejs,
       src/views/feed.ejs, src/views/explorar.ejs,
       src/views/explorar/busca.ejs (deletado), src/public/sw.js,
       docs/qa/route-inventory.md.
Motivo: Unificar "Explorar" como única superfície de descoberta, eliminando
        duplicidade de lógica/UI (7 pontos de entrada redundantes).
Impactos: Página /explorar/busca retorna 404; usuários encontram pets/pessoas
          via grade do /explorar + recomendações da sidebar.
Rollback: git reset --hard HEAD~1 (ambiente local).
```
