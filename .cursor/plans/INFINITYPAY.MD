# INFINITYPAY - Contrato de integração (AIRPET TAG)

## Objetivo

Padronizar a integração de pagamento para:

- Compra de hardware (`compra_tag` / `combo_primeira_vez`)
- Renovação de assinatura (`assinatura_recorrente`)

## Endpoint base

- API base: `https://api.infinitepay.io`
- Criação de link: `POST /invoices/public/checkout/links`

## Campos críticos

- `order_nsu`: identificador único do pedido no AIRPET (ex.: `tag-<timestamp>-<rand>`)
- `items[]`: preços em centavos
- `redirect_url`: URL de retorno para o app
- `webhook_url`: endpoint público para confirmação assíncrona
- `transaction_nsu`: id da transação aprovada no webhook

## Segurança mínima

1. Não confiar apenas no `redirect_url` para marcar pagamento.
2. Sempre processar pagamento por webhook (ou dupla validação webhook + `payment_check`).
3. Idempotência obrigatória por `(provider, transaction_nsu, event_type)`.
4. Validar valor recebido vs `snapshot_json` do pedido.
5. Em produção, validar assinatura do webhook (quando disponível) via `INFINITEPAY_WEBHOOK_SECRET`.

## Fluxo recomendado

1. Criar pedido interno (`tag_product_orders`) com status `aguardando_pagamento`.
2. Gerar `order_nsu` único.
3. Chamar `POST /checkout/links`.
4. Salvar `checkout_url`, `invoice_slug`, `order_nsu`.
5. Redirecionar usuário para `checkout_url`.
6. Receber webhook de pagamento:
   - Registrar `payment_events`
   - Validar idempotência
   - Marcar pedido como `pago`
   - Renovar assinatura (`valid_until = max(valid_until, now) + 30 dias`)
   - Alocar tag(s) se `order_type` for compra de hardware

## Regras AIRPET acopladas ao pagamento

- Grace period padrão: `72h` após `valid_until`.
- Compra de nova tag para o mesmo pet:
  - ativa nova tag
  - desativa tag anterior do mesmo `pet_id`
- Limite comercial: máximo `10` pets por usuário no fluxo TAG pago.

## Variáveis de ambiente

- `INFINITEPAY_TOKEN`
- `INFINITEPAY_API_BASE` (opcional, default API oficial)
- `INFINITEPAY_WEBHOOK_SECRET` (recomendado)
- `BASE_URL` (necessário para `redirect_url` / `webhook_url`)

## Runbook rápido de incidentes

1. **Webhook caiu**: reprocessar payload salvo em `payment_events`.
2. **Pedido pago não atualizado**: buscar por `order_nsu` e `transaction_nsu`, aplicar rotina de reconciliação.
3. **Cobrança duplicada**: validar idempotência, abrir procedimento de estorno.
4. **Divergência de valor**: bloquear atualização automática e sinalizar para revisão manual.