---
name: TAG NFC paga e dashboard
overview: Unir scan/resgate com SaaS de TAG paga, personalização pet/foto, páginas de venda claras, plano com ciclo de 30 dias renovado por pagamento (validação server-side + indicador na tag), tiers de recursos (incl. busca), InfinitePay e camada antifraude.
todos:
  - id: schema-order-units
    content: "Migrar/criar tabelas: pedido TAG (SaaS) + tag_order_units com pet_id, print_photo_url, personalization_status, FKs e constraints"
    status: pending
  - id: schema-entitlement-30d
    content: "Tabelas/campos: assinatura ou entitlements com valid_until (base 30d), plano_slug, snapshot preço; histórico de pagamentos e renovações"
    status: pending
  - id: paginas-venda
    content: "EJS landing + pricing: benefícios, comparativo de planos, CTA login/compra; copy explícito sobre ciclo 30 dias e o que a tag mostra"
    status: pending
  - id: infinitepay-e-alocacao
    content: Implementar fluxo InfinitePay (links + webhook + payment_check); pós-pagamento estender valid_until + alocar tags; preencher INFINITYPAY.MD no repo
    status: pending
  - id: servico-entitlement
    content: "Serviço único: requirePlanoAtivo(usuario|pet), bloqueio de rotas premium; job lembrete pré-expiração e grace opcional"
    status: pending
  - id: scan-indicador-plano
    content: "Tela pública/tag: selo Plano ativo até DD/MM ou Plano suspenso — sem confiar só em token de cliente"
    status: pending
  - id: matriz-planos-busca
    content: Definir e implementar matriz plano x recursos (busca explorar, mapas avançados, painel resgate completo, etc.)
    status: pending
  - id: antifraude-pagamento
    content: "Idempotência webhook, conferência valor/itens vs snapshot, rate limit, auditoria; tokens de sessão httpOnly se usados"
    status: pending
  - id: limite-10-pets
    content: "Enforçar teto máx 10 pets por usuário no fluxo pago TAG (checkout, ativação, mensagens na loja)"
    status: pending
  - id: grace-period-jwt
    content: "Implementar grace 48–72h pós-valid_until + política JWT curta (15m–1h) só como transporte, plano sempre no PG"
    status: pending
  - id: doc-producao
    content: "Checklist pré-prod: INFINITYPAY.MD, regra renovação, limites, runbook webhook, testes de carga mínimos"
    status: pending
  - id: wizard-pet-foto
    content: "Rotas + EJS: escolher pet, foto (principal ou upload), confirmar snapshot no servidor"
    status: pending
  - id: dashboard-pedidos-tag
    content: "Lista/detalhe de pedidos no dashboard tutor: status, petshop próximo, próximos passos e deep links"
    status: pending
  - id: integrar-ativacao
    content: Validar ativação contra unidade alocada; opcional exibir miniatura da arte na ativação
    status: pending
  - id: alinhar-foco-scan
    content: Após MVP comercial, priorizar itens do plano foco_tag_nfc_sem_rede no scan público
    status: pending
isProject: false
---

# Plano: TAG NFC paga + personalização + vendas + plano 30 dias + antifraude

## Relação entre os planos existentes

- **[foco_tag_nfc_sem_rede_22b6d103.plan.md](.cursor/plans/foco_tag_nfc_sem_rede_22b6d103.plan.md)** — pós-ativação: scan rico, lembretes, privacidade ([`src/services/nfcService.js`](src/services/nfcService.js), [`src/views/nfc/intermediaria.ejs`](src/views/nfc/intermediaria.ejs)).
- **[saas_tag_nfc_premium_6e2f2e11.plan.md](.cursor/plans/saas_tag_nfc_premium_6e2f2e11.plan.md)** — comércio, InfinitePay, alocação, petshop.

**Nota:** [.cursor/plans/INFINITYPAY.MD](.cursor/plans/INFINITYPAY.MD) está **vazio no repositório**. Antes de codificar, preencher com o contrato oficial (URLs, headers, assinatura de webhook, exemplos). Referência provisória já descrita no plano SaaS: `POST https://api.infinitepay.io/invoices/public/checkout/links`, `order_nsu`, `redirect_url` + `payment_check`, `webhook_url`, valores em **centavos**, corpo com `order_nsu` / `transaction_nsu`.

---

## Pré-implementação: o que precisa de atenção (reforçado)

Resumo do que já está bom no plano: ciclo **venda → pagamento → ativação → scan**, antifraude na integração, **matriz de recursos** e fluxo ordenado. Abaixo, o que **não pode ir para código sem estar fechado** — evita retrabalho e incidente em produção.

| Tema | Por que importa | Ação antes de codar |
|------|-----------------|---------------------|
| **Contrato InfinitePay** | Endpoint, headers, corpo do webhook e `payment_check` errados geram cobrança não reconhecida ou duplicada. | Preencher [INFINITYPAY.MD](.cursor/plans/INFINITYPAY.MD) com doc oficial + 1 exemplo real (request/response) + o que fazer em disputa. |
| **Regra de renovação dos 30 dias** | Usuário e suporte precisam da mesma história; evita “sumiram meus dias”. | Fechar fórmula única (ver **Riscos e decisões** abaixo) e copiar **literalmente** para landing, checkout e FAQ. |
| **Fonte da verdade no servidor** | Front pode ser alterado; plano “ativo” falsificado em `localStorage`/`sessionStorage`. | Toda decisão de premium: ler **`valid_until` + `plan_slug` no PG** (e grace) em middleware, `nfcService` e jobs. Front só exibe o que a API mandou. |
| **Grace period (48–72h)** | Cartão atrasado, fuso, webhook lento — churn e pânico do tutor. | Definir `grace_until` (ou `now <= valid_until + interval`) e **nível de serviço durante grace** (ex.: scan completo vs. só básico). Documentar para suporte. |
| **JWT / tokens curtos** | JWT longo = janela grande se vazar; não substitui assinatura. | Se usar JWT (app/API): **vida curta** (ex. 15 min–1 h) + refresh controlado; claims **nunca** são autoridade final — sempre validar plano no banco na operação sensível. Preferir sessão `httpOnly` no web. |
| **Teto 10 pets por usuário** | Limite comercial explícito no teu resumo. | Validar no **checkout**, **ativação de TAG paga** e (se aplicável) **cadastro do 11º pet**; mensagens claras na loja e no dashboard. |
| **Documentação pré-produção** | On-call e financeiro dependem disso. | Runbook: reprocessar webhook, cancelar pedido, estorno; checklist de go-live (abaixo). |

---

## Páginas de venda (deixar explícito)

Objetivo: usuário entender **o que compra**, **por quanto tempo vale**, **o que a tag mostra** e **como renovar**.

| Página | Conteúdo mínimo |
|--------|------------------|
| **Landing TAG** (`/tag` ou `/loja-tag`) | Proposta de valor (resgate + identificação), como funciona em 3 passos, prova social opcional, CTA “Ver planos” / “Comprar”. |
| **Planos e preços** | Tabela comparativa dos **tiers** (ver seção abaixo): o que cada um libera (scan básico vs. completo, busca, mapa, notificações). |
| **Checkout** | Resumo do carrinho (qtd tags, petshop se aplicável), **texto legal curto**: ciclo de **30 dias** a partir da confirmação de pagamento (ou da data acordada), renovação ao pagar novo link/fatura, consequência de expirar (tag continua física mas recursos premium caem). |
| **Pós-pagamento** | Estado do pedido + próximos passos (personalização, retirada, ativação) — já previsto no fluxo dashboard. |

Design: reaproveitar Tailwind/partials existentes; hierarquia visual forte (preço, duração do plano, “inclui X dias de serviço”).

---

## Plano ativo: ciclo de 30 dias e renovação por pagamento

**Regra de negócio (fonte da verdade no servidor):**

- **Regra de renovação fechada (recomendada):** a cada pagamento aprovado, `valid_until_novo = max(valid_until_atual, data_hora_confirmacao_pagamento) + 30 dias`. Assim **não se perdem dias já pagos** (renovação antecipada **empilha** sobre o saldo restante). Alternativa rara: sempre `paid_at + 30d` (ignora saldo) — só usar se negócio exigir; se escolher, comunicar com muito destaque.
- **Não** usar apenas JWT no browser como prova de assinatura: token pode ser **complemento** (ex.: cookie de sessão), mas **middleware e scan** consultam **PostgreSQL** (`tag_subscriptions` / `usuario_entitlements` ou campos em `usuarios`).

**Renovação:** conforme InfinitePay (link por cobrança), ao receber webhook/`payment_check` válido, numa **transação**: gravar pagamento, atualizar `valid_until`, registrar `transaction_nsu` com **idempotência**.

**Indicador na tag (público):** ao montar dados em [`nfcService.processarScan`](src/services/nfcService.js), incluir flags derivadas do servidor, por exemplo:

- `planoAtivo: boolean` = considerar **`valid_until` + grace** (ex.: premium efetivo até `valid_until + 72h` se essa for a política).
- `planoExpiraEm: date | null` (opcional, para microcopy “Serviço premium ativo até …”; em grace pode mostrar “Renove em até X para não perder …”).

Assim a **tela intermediária** pode mostrar selo **“Dentro do plano”** ou **“Plano inativo — contato básico”** sem depender de cliente adulterar token.

**Token / JWT (segurança):** o **período comercial de 30 dias** vive no **PG** (`valid_until`), não no JWT.

- **JWT** (se existir): expiração **curta** (ordem de **15 min a 1 h**); uso principal identificar sessão/dispositivo, **não** substituir consulta a `valid_until` + grace em rotas premium e no fluxo de scan enriquecido.
- **Token opaco** (link mágico, API): mesma lógica — revogável em tabela, validação sempre cruzada com plano no servidor.
- Sessão web: cookie **httpOnly** + **secure** em produção.

---

## Matriz sugerida: planos e “busca” / serviços

Alinhar com o que já existe no código para não prometer o que não existe na v1:

| Recurso | Onde hoje | Sugestão de tier |
|---------|-----------|-------------------|
| Scan NFC público + dados básicos do pet | [`nfcService`](src/services/nfcService.js) | **Base** (sempre, ou mínimo se tag ativa) |
| Scan com painel “completo” (localização, ações extras, etc.) | Plano foco sem rede | **Premium** |
| Busca social / explorar pets e usuários | [`explorarController.paginaBusca`](src/controllers/explorarController.js) | **Gratuita** (decisão: não exigir plano TAG; premium concentra scan completo, mapa/resgate avançado, notificações) |
| Formulário pet perdido (mapa, busca endereço) | [`pets-perdidos/formulario.ejs`](src/views/pets-perdidos/formulario.ejs) | Premium para **prioridade** ou mapa avançado; base só alerta simples |
| Sugestão petshop próximo no contexto de resgate | [`petshopRecoveryIntegrationService`](src/services/petshopRecoveryIntegrationService.js) | Premium |
| Notificações completas multicanal | Plano foco | Premium |

**Entrega:** documentar a matriz em código (`config/planos.js` ou tabela `plan_definitions`) para **uma única fonte** usada pela landing, pelo middleware e pelo `nfcService` (feature flags por `plan_slug`).

---

## Pagamento: lógica completa e permanência no plano

1. **Criar pedido** no backend com `snapshot_json` (preço, itens, `plan_slug`, duração em dias).
2. **InfinitePay:** criar link com `order_nsu` estável; redirecionar usuário; na volta, **`payment_check`** na `redirect_url`.
3. **Webhook:** marcar pago **uma vez** por `transaction_nsu` (tabela idempotência, padrão [`ApiIdempotencyResponse`](src/models/ApiIdempotencyResponse.js) se aplicável).
4. **Conferência antifraude (servidor):** valor total e itens do webhook devem **bater** com o pedido pendente; rejeitar se pedido já cancelado/expirado ou usuário diferente.
5. **Efeito colateral:** estender `valid_until` + liberar entitlements + alocar tags conforme plano SaaS.

---

## Antifraude e segurança (checklist)

- **Idempotência:** `transaction_nsu` / `order_nsu` únicos processados uma vez.
- **Integridade:** nunca confiar no front para preço final; sempre snapshot no pedido.
- **Webhook:** validar assinatura se a InfinitePay documentar; senão, cruzar com `payment_check` e IP allowlist quando possível.
- **Rate limit:** rotas de checkout, webhook e ativação (já há cultura no projeto).
- **Sessão:** cookies `httpOnly`/`secure`; não colocar “plano ativo” só em `localStorage`.
- **JWT:** vida curta; sem claims de “plano vitalício”; operações críticas sempre revalidam banco.
- **Scan público:** não expor dados sensíveis mesmo com plano ativo; diferenciar **nível de detalhe**, não segurança zero quando expirado.

---

## Modelagem de dados (extensão — resumo)

- Manter `tag_product_orders`, `tag_order_units`, evolução `nfc_tags` (plano anterior).
- Acrescentar **entitlement explícito**: por `usuario_id` (ou `pet_id` se cobrança por pet): `plan_slug`, `valid_until`, `last_renewal_at`, `last_transaction_nsu`.
- Opcional: `payment_events` para auditoria e disputas.

---

## Fluxo unificado (mermaid)

```mermaid
flowchart TD
  Venda[Paginas_venda] --> Auth[Usuario_logado]
  Auth --> Checkout[InfinitePay_link]
  Checkout --> WH[Webhook_ou_payment_check]
  WH --> Idem[Idempotencia_e_valida_valor]
  Idem --> Extend[valid_until_plus_30d]
  Extend --> Aloca[Alocar_tags]
  Aloca --> Dash[Dashboard_pedido]
  Dash --> Personaliza[Pet_e_foto]
  Personaliza --> Scan[Scan_com_sello_plano]
```

---

## Ordem de implementação sugerida (atualizada)

1. Preencher **INFINITYPAY.MD** + schema pedido + **entitlement 30d**.
2. **Serviço de plano** + middleware + `config`/tabela de definições de planos (incl. busca).
3. **Páginas de venda** + checkout.
4. Integração **InfinitePay** + antifraude.
5. **nfcService** + view intermediária: indicador “dentro do plano”.
6. Wizard pet/foto + dashboard pedido + ativação.
7. Plano foco sem rede (scan rico) amarrado aos tiers premium.

---

## Arquivos prováveis (repo)

- Novos: `src/views/tag-venda/`, `src/controllers/tagVendaController.js`, `src/services/tagEntitlementService.js`, `src/services/infinitePayService.js`, modelos de pedido/entitlement.
- Alterar: [`nfcService.js`](src/services/nfcService.js), [`intermediaria.ejs`](src/views/nfc/intermediaria.ejs), [`src/routes/index.js`](src/routes/index.js) ou router dedicado, [`partials/nav.ejs`](src/views/partials/nav.ejs).
- Doc: [.cursor/plans/INFINITYPAY.MD](.cursor/plans/INFINITYPAY.MD) (contrato API).

---

## Riscos e decisões rápidas

- **Âncora dos 30 dias (fechada no plano):** usar **`valid_until_novo = max(valid_until_atual, momento_confirmacao_pagamento) + 30 dias`** — preserva saldo de dias já pagos; alinhar marketing e suporte a esta frase única.
- **Teto comercial:** **máximo 10 pets por usuário** no escopo do produto TAG pago — bloquear compra/ativação que ultrapasse; expor o limite na **loja** e no **dashboard** (evita frustração no checkout).
- **Grace period:** **48–72h** após `valid_until` (definir valor fixo, ex. 72h), com política explícita: durante grace, **quais recursos** permanecem (ex. scan premium sim/não). Após grace, degradar para baseline documentado.
- **INFINITYPAY.MD vazio:** risco alto de endpoint/payload errado — **bloqueio de deploy** até doc + teste em sandbox/homologação com webhook real ou ferramenta da adquirente.
- **Dica operacional:** **documentar tudo antes de produção** — runbook mínimo: (1) reprocessar webhook seguro, (2) estorno/cancelamento de pedido, (3) usuário com plano errado (correção manual de `valid_until`), (4) quem acorda se pagamento cair às 3h. Checklist go-live: variáveis de ambiente (`WEBHOOK_SECRET`, URLs), monitoramento de taxa de 4xx/5xx no webhook, alerta se `payment_check` divergir do PG.
