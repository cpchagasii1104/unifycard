# EXECUTION LOG — Reconciliação: único motor de detecção (0053+)

- modo: EXECUTOR
- objetivo: eliminar detecção/persistência de inconsistência financeira fora de `reconciliation-engine.service.ts`
- status: SUCESSO

## Alterações

1. **Settlement** (`backend/src/modules/gateway/payment-event-resolver.ts`): removido `reconciliationDiscrepancyRepository.create` em mismatch de valor; mantido `throw SETTLEMENT_AMOUNT_MISMATCH` (segurança de execução).
2. **Gateway legado** (`backend/src/modules/reconciliation/gateway-reconciliation.service.ts`): removida toda comparação payment_intent vs `bank_transactions` e gravação de discrepância; `runTransactionReconciliation` retorna relatório vazio.
3. **Bank legado** (`backend/src/modules/reconciliation/bank-reconciliation.service.ts`): removida verificação de `bank_payout` e gravação; `runBankReconciliation` retorna relatório vazio (assinatura preservada).

## Não alterado (conforme prompt)

- `reconciliation-engine.service.ts`
- Schema de banco
- `reconciliation.service.ts` / repositório legado (ainda usados por testes e possível ingestão manual)

## Arquivos afetados

- `backend/src/modules/gateway/payment-event-resolver.ts`
- `backend/src/modules/reconciliation/gateway-reconciliation.service.ts`
- `backend/src/modules/reconciliation/bank-reconciliation.service.ts`
- `docs/03_execution_log/2026-03-24_reconciliation_ssot_single_engine.md`
