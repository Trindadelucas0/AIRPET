# Checklist — funil Proteger meu pet (produção)

## Antes do deploy

- [ ] Rodar migrações: `npm run db:migrate` (inclui `lista_espera.referral_code`).
- [ ] `FEATURE_LANDING_V2`: omitir ou `true` para landing nova; `false` ou `0` volta para `proteger-meu-pet-legacy`.
- [ ] `BASE_URL` público correto (OG, e-mail, links de indicação).
- [ ] `RESEND_API_KEY`, `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` para e-mail de confirmação da lista.
- [ ] Opcional: `PLAUSIBLE_DOMAIN` e/ou `GA_MEASUREMENT_ID` + snippet já incluído em `funil-meta.ejs`.
- [ ] Opcional: `INSTAGRAM_URL` para o link na página `/obrigado`.
- [ ] Opcional: `LANDING_STATS_TTL_MS` (padrão 60000) para cache das métricas da landing.

## Imagens

- [ ] Rodar `npm run images:optimize-landing` após `npm install` (gera `.webp` ao lado dos JPGs).
- [ ] Conferir LCP da hero (`/images/landing/hero.jpg`).

## Depois do deploy

- [ ] Abrir `/proteger-meu-pet` em aba anônima: layout, FAQ, CTAs, skip link.
- [ ] Completar `/lista-espera` e chegar em `/obrigado`: posição na fila, cópia do link `?ref=`, e-mail recebido.
- [ ] Pré-visualizar OG (WhatsApp / LinkedIn / X) com URL canônica.
- [ ] `GET /sitemap.xml` inclui `/proteger-meu-pet` e `/lista-espera`.
- [ ] Admin `/admin/lista-espera`: novas inscrições aparecem; export CSV continua ok.

## Rollback rápido

- [ ] Definir `FEATURE_LANDING_V2=false` e redeploy para voltar à landing legada (`proteger-meu-pet-legacy.ejs`).

## Lighthouse (mobile, alvo)

- Performance ≥ 85 · Acessibilidade ≥ 95 · Boas práticas ≥ 95 · SEO ≥ 90 (página `noindex` no wizard/obrigado reduz SEO score — esperado).
