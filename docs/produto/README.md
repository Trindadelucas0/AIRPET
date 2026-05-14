# AIRPET — Specs de produto (rede social pet-first)

Conjunto de specs que materializam a visão descrita no plano `airpet_rede_social_pets`. Cada documento é curto, acionável e referencia o código existente quando aplicável.

A ordem dos documentos espelha a hierarquia de entrega: fundação viral → hábito → descoberta → prestígio → comunidade.

| # | Spec | Fase | Status atual no código |
|---|------|------|------------------------|
| 01 | [Perfil do pet como personalidade](./01-perfil-pet-personalidade.md) | A — fundação | Slug público, foto, capa, bio dono existem; falta UX pet-first |
| 02 | [Grafo "seguir pet"](./02-grafo-seguir-pet.md) | A — fundação | Tabela `seguidores_pets` e `SeguidorPet.js` prontos; falta home e push |
| 03 | [Separação de feeds (Pets x Parceiros)](./03-separacao-feeds.md) | A — fundação | Domínios separados em DB; falta arquitetura visual de abas |
| 04 | [Badges visíveis e gamificação](./04-badges-gamificacao.md) | A — fundação | `user_gamification`/`badges`/`user_badges` no schema; falta UI |
| 05 | [Stories 24h e desafios semanais](./05-stories-desafios.md) | B — hábito | Não existe (TTL); `diario_pet` é log, não story |
| 06 | [Hashtags e descoberta](./06-hashtags-descoberta.md) | B — hábito | `feed_candidate_pool` tem segmentos; falta entidade hashtag |
| 07 | [Pet do mês, mapa social, grupos](./07-prestigio-mapa-grupos.md) | C/D — prestígio + comunidade | Geo pronto via PostGIS; falta votação, pins, grupos |
| 08 | [Tutorial — demo social (URLs + seed)](./08-tutorial-demo-social.md) | QA / dev | Hashtag `/h/…`, pet do mês, grupos, stories; migration `177622…` |

## Princípios transversais (resumo)

1. **Pet como objeto social primário.** O grafo central é "usuário → pet" (já modelado em `seguidores_pets`), não "usuário → usuário".
2. **Separação rígida de feeds.** Conteúdo emocional (`publicacoes`) e comercial (`petshop_posts`) nunca compartilham o mesmo scroll.
3. **Rituais geram conteúdo.** Stories e desafios são os motores diários; tudo o mais é amplificador.
4. **Privacidade por padrão.** Localização aproximada (bairro/cidade), opt-in explícito para mapa, moderação desde o MVP.
5. **Gamificação serve ao comportamento.** Badges existem para reforçar ações que geram UGC, nunca como vaidade isolada.

## Como ler estas specs

Cada documento segue o mesmo molde:

```
1. Problema e oportunidade
2. O que já existe (refs ao código)
3. Spec funcional (UX + dados + endpoints)
4. Métricas de sucesso
5. Riscos e anti-padrões
6. Entrega faseada
```

Não há código novo aqui — apenas decisões de produto. Implementação fica em PRs separados, um por spec, referenciando o documento correspondente.
