# Runbook — Compensação ledger-aware (INFRA-4.1)

**Princípio:** o ledger append-only **nunca** é editado. Compensação = **nova** `bank_transaction` + lançamentos no ledger (débito/crédito inversos), registada em `ledger_compensations` e notificada via outbox (`ledger.transaction.compensated`).

## Quando compensar

- Correção financeira após falha de processo **depois** de uma transferência já concluída (`internal_completed_at` preenchido).
- Cenários operacionais acordados (ex.: rollback de efeito de pagamento após `order.saga.failed`), sempre com razão documentada.
- Requer transação original com **exactamente duas** pernas no ledger (um débito, um crédito) — transferências simples P2P.

## Quando **não** compensar

- Transação original incompleta ou inexistente.
- Tipos `reference_type` `ledger_compensation` ou `financial_reversal` na origem (evitar cadeias ambíguas).
- Splits / múltiplas pernas no ledger para o mesmo `transaction_id` — usar motor de reversão ou fluxo dedicado.
- Saldo insuficiente na conta que deve **enviar** o valor inverso (a API de transfer falhará com `INSUFFICIENT_FUNDS`).
- Duplicar compensação: `UNIQUE (tenant_id, original_transaction_id)` garante uma linha em `ledger_compensations`; chamadas repetidas devolvem o mesmo `compensation_transaction_id`.

## API

`compensateTransaction(tenantId, originalTransactionId, reason)` em `backend/src/modules/bank/ledger-compensation.service.ts`.

Fluxo:

1. Valida existência e conclusão da transação original.
2. Valida forma do ledger (2 entradas; mesma moeda nas contas).
3. Executa `bankTransactionService.transfer` com `reference_type = 'ledger_compensation'` e `reference_id = originalTransactionId` (idempotência de transferência).
4. `INSERT ledger_compensations`.
5. `insertEventOutboxRow` com seed `ledger.compensation:${tenantId}:${originalTransactionId}`.

## Idempotência e corridas

- Outbox: `ON CONFLICT (event_id) DO NOTHING`.
- Se outro processo inserir primeiro em `ledger_compensations`, a segunda chamada devolve `alreadyExisted: true` e tenta garantir o evento outbox (best-effort).

## Investigar erro financeiro

1. `bank_transactions` + `bank_ledger` pela `original_transaction_id`.
2. `ledger_compensations` por `tenant_id` + `original_transaction_id`.
3. `event_outbox` com `event_type = 'ledger.transaction.compensated'`.
4. Comparar com INFRA-3 (`docs/runbooks/reconciliation.md`) para drift de saldos vs movimentos.

## Métricas

- `ledger_compensation_created_total`
- `ledger_compensation_failed_total`

Labels: `from_status`, `to_status`, `tenant_id` (campos de contexto reutilizados; valores `_na` quando não aplicável).

## Relação com sagas

`order.saga.failed` **não** dispara compensação automaticamente. O operador ou um handler futuro deve decidir e chamar `compensateTransaction` quando fizer sentido.
