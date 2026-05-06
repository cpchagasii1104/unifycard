# Execução — Prompt 51 — Reversal Engine (Refund / Cancelamento Financeiro)

**Data:** 2026-03-17  
**Modo:** EXECUTOR  
**Status:** SUCESSO (após aplicar migration `0051_reversal_engine.sql`)

## Objetivo

Fluxo formal de reversão financeira (refund, cancelamento com impacto), precedência causal: **mutation → estado → dinheiro → evento**, sem alterar histórico em `bank_ledger` existente.

## Regras absolutas

- Não deletar transações originais; não reescrever linhas antigas do ledger
- Reversão = **nova** transação (transfer espelhado via `bankTransactionService.transfer`)
- Idempotência: `reference_type = financial_reversal`, `reference_id = original_transaction_id`
- `UNIQUE(original_transaction_id)` na tabela `reversals`
- Tesouraria: origem system na reversão usa `treasury:reversal` (Prompt 50)

## Artefatos

| Item | Caminho |
|------|---------|
| Migration | `backend/migrations/0051_reversal_engine.sql` |
| Repositório | `backend/src/modules/reversal/reversal.repository.ts` |
| Serviço | `backend/src/modules/reversal/reversal.service.ts` |
| Worker | `backend/src/workers/reversal-worker.ts` (30s, batch 30) |
| BOOT | `startReversalWorker()` após Payout Worker |
| Tipo | `treasury:reversal` em `TreasuryOperationSource` |
| Testes | `backend/tests/unit/reversal-engine.test.ts` |

## Fluxo

1. `requestReversal` → INSERT `reversals` (`pending`) → evento `reversal_requested`
2. Worker `claimPendingReversals` → `processing`
3. `executeReversal`: uma transação SQL — lock registro + transação original — valida (2 entradas ledger, sem splits, valor batendo, saldo na conta que devolve) → `transfer(..., client)` → UPDATE `executed` + `reversal_transaction_id` → COMMIT → `reversal_executed`
4. Falha → ROLLBACK → `markFailed` → `reversal_failed`

## Elegibilidade (v1)

- Transação original concluída (`internal_completed_at` preenchido)
- Exatamente 2 linhas no ledger (débito/crédito), mesmo valor
- Sem `bank_splits` na transação original
- `reference_type` original ≠ `financial_reversal`

## Integração futura

Governance / payout / settlement podem chamar `requestReversal`; worker executa. Retentativa após `failed`: `resetFailedToPending` no repositório + novo claim.

## Testes

Rodar com DB e migration aplicada: `pnpm test -- tests/unit/reversal-engine.test.ts --forceExit`

Se a tabela `reversals` não existir, os testes fazem skip com aviso no console.
