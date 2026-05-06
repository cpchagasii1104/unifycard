# REBASE-04.2 — Split canónico (bank_splits)

**Data:** 2026-03-18  
**Modo:** EXECUTOR  

---

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `backend/src/modules/bank/bank-transaction.service.ts` | `createTransactionWithExplicitSplitLines`: transação + débito pagador + créditos + `bank_splits`; idempotência por `(reference_type, reference_id)`; validação de soma na mesma sessão SQL. |
| `backend/src/modules/bank/bank-integration.service.ts` | `resolveBankAccountForServiceActor`, `processServicePaymentExecutionCanonical` (referência bank = `service_payment_request` + `payment_request_id`). |
| `backend/src/modules/services/service-payment-execution.repository.ts` | `findSplitsByExecutionId` lê `bank_splits` via `metadata.bankTransactionId`; `create` aceita `executionId` opcional; `createSplit` mantém throw (proteção). |
| `backend/src/modules/services/service-payment-execution.service.ts` | Fluxo: BRL + pagador user → uma chamada bank canónica → `create` com `bankTransactionId`; removidos duplo `processServiceBookingPayment` e chamadas a `createSplit`. |

---

## Lógica implementada

1. **Idempotência:** `bank_transactions.reference_type = 'service_payment_request'`, `reference_id = payment_request_id` — uma transação bank por pedido.
2. **Splits:** Linhas explícitas em `bank_splits` (`revenue_share`), `receiverActorId` em metadata; soma = `amount_cents` da transação.
3. **Ordem:** Bank primeiro (evita execução sem movimento); em seguida INSERT `service_payment_executions` com `execution_id` pré-gerado e `bankTransactionId` no metadata.
4. **Leitura de splits:** `findSplitsByExecutionId` agrega `bank_splits` + `bank_accounts.actor_id` para `receiverActorId`.

---

## Validações

- Soma dos recipients = `paymentRequest.amountCents`.
- Limite diário (bank-limit) antes da transação.
- Trigger/invariante de soma de splits vs transação (validação adicional no mesmo `client` antes do COMMIT).

---

## Build

`cd backend && pnpm build` — **SUCESSO**.

---

## payment_splits

- **Escrita:** continua bloqueada em `createSplit` (`DERIVA_FINANCEIRA_BLOQUEADA`).
- **Fluxo de execução de serviço:** não insere mais em `payment_splits`.
- **Leituras legadas:** `economic-overview.projector.ts` e `groups-closure.routes.ts` ainda consultam `payment_splits` (dados históricos até migração).
