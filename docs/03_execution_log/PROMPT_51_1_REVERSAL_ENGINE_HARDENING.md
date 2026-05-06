# Execução — Prompt 51.1 — Reversal Engine Hardening

**Data:** 2026-03-17  
**Modo:** CONSTITUCIONAL / CORRETIVO

## Objetivo

Endereçar auditoria do Prompt 51: decisão operacional sem depender do ledger como SSOT; split reversível; idempotência em camadas; pipeline (PaymentIntent); caminho legado único.

## 1. SSOT operacional (não ledger)

- **Valor e conta debitada (pagador original):** `bank_transactions.amount_cents`, `bank_transactions.account_id`.
- **Contraparte (recebedor original):** `bank_transactions.counterpart_account_id` (migration **0052**).
- **Novas transferências** preenchem `counterpart_account_id`; se a coluna não existir, INSERT faz fallback (compat pré-0052).
- **Legado sem counterpart:** uma única linha `credit` no ledger → roteamento documentado + evento `reversal_counterparty_ledger_fallback`.

## 2. Reversão composta (split)

- Se existem linhas em `bank_splits` com `target_account_id` (ou resolução via `target_actor_id` → `bank_accounts`), soma das pernas = `amount_cents` da transação original.
- Cada perna: `transfer` inverso com `reference_type = financial_reversal_leg`, `reference_id = uuidv5(reversalId:splitId)` (idempotência por perna).

## 3. Idempotência em camadas

| Camada | Mecanismo |
|--------|-----------|
| Lógica | `UNIQUE(original_transaction_id)` em `reversals` |
| Financeira (simples) | `financial_reversal` + `reference_id = reversalId` (UUID do registro) |
| Financeira (split) | `financial_reversal_leg` + UUID v5 por perna |

## 4. Pipeline — PaymentIntent

- Após COMMIT da reversão: `createPaymentIntent` com `gateway: reversal_engine`, `reference_id: reversal-pipeline-{reversalId}`, `status: completed`, metadata `kind: financial_reversal_pipeline`, lista de `reversal_bank_transaction_ids`.

## 5. Caminho legado eliminado

- `bankTransactionService.reverseTransaction` → **bloqueado** (`REVERSE_TRANSACTION_DEPRECATED`).
- **Único caminho de produto:** `bankIntegrationService.reverseTransaction` → `requestAndExecuteReversalSync` (cria registro, processing, executa).

## 6. Migrations

- **0052_reversal_engine_hardening.sql:** `bank_transactions.counterpart_account_id`, `reversals.reversal_transaction_ids`.
- UPDATE de `reversal_transaction_ids` com fallback se coluna ausente.

## 7. Arquivos tocados

- `reversal.service.ts` — lógica 51.1, `requestAndExecuteReversalSync`, PaymentIntent.
- `bank-transaction.service.ts` — counterpart opcional + fallback INSERT; `reverseTransaction` deprecado/bloqueado.
- `bank-integration.service.ts` — ponte formal.
- Testes de integração: `bank-transactions-splits`, `bank-invariants`, `bank-modules-integration`.
- Rides já usavam `bankIntegrationService.reverseTransaction`.

## 8. Dependências

- Tabela `reversals` (0051) obrigatória para reversão formal.
- Recomendado aplicar **0052** para counterpart e arrays de transação.
