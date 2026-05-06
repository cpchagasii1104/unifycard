# EXECUTION LOG — Settlement Lock + Amount Guard

- etapa_do_plano: hardening settlement execution
- objetivo_executado: trava física de execução e validação estrita de valor no settlement
- status: SUCESSO

## Ações realizadas

1. Criada migration forward-only `backend/migrations/0086_payment_execution_lock.sql` com tabela `payment_execution_lock` e `UNIQUE(reference_id, type)`.
2. Endurecido `backend/src/modules/gateway/payment-event-resolver.ts` no fluxo `settleEscrowedPaymentIntent`:
   - validação `external_amount_cents` vs `ledger_amount_cents` com registro em `reconciliation_discrepancies` e erro `SETTLEMENT_AMOUNT_MISMATCH`;
   - lock pessimista `FOR UPDATE` no `payment_intents` alvo;
   - lock físico por `INSERT INTO payment_execution_lock(reference_id, 'settlement')` com abort por unique violation;
   - abort quando já existe `external_settled_at` para a referência;
   - remoção de mutação financeira de settlement (sem transferência/ledger write), mantendo apenas `external_settled_at`.

## Arquivos afetados

- `backend/migrations/0086_payment_execution_lock.sql`
- `backend/src/modules/gateway/payment-event-resolver.ts`
- `docs/03_execution_log/2026-03-24_settlement_execution_lock_and_amount_guard.md`
