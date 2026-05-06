# Execução — Prompt 52 — Reconciliation Engine (diagnóstico constitucional)

**Data:** 2026-03-17  
**Modo:** AGENT  
**Status:** Implementado (aplicar migrations `0053` + `0054` no ambiente)

## Objetivo

Garantir **integridade financeira observável** entre `bank_transactions`, `bank_ledger` e (opcionalmente) referência de saldo em conta — **sem** alterar SSOT, **sem** mover dinheiro, **sem** corrigir ledger automaticamente.

## Regras absolutas

- Não UPDATE/DELETE em `bank_ledger` nem `bank_transactions`
- Não recalcular saldo de produção; não criar saldo manual como SSOT
- Correção apenas via fluxo formal (transfer / reversal) fora deste motor
- Motor = **leitura** (snapshot `REPEATABLE READ`) + **escrita** só em tabelas de reconciliação

## Artefatos

| Item | Caminho |
|------|---------|
| Migration runs + discrepâncias | `backend/migrations/0053_reconciliation_engine.sql` |
| Migration coluna opcional conta | `backend/migrations/0054_reconciliation_balance_column.sql` (`reconciliation_balance_cents` NULL = ignorar `account_mismatch`) |
| Repositório | `backend/src/modules/reconciliation/reconciliation.repository.ts` |
| Serviço | `backend/src/modules/reconciliation/reconciliation-engine.service.ts` → `runReconciliation(tenantId)` |
| Worker | `backend/src/workers/reconciliation-engine-worker.ts` (default **5 min**; `RECONCILIATION_ENGINE_INTERVAL_MS`) |
| BOOT | `startReconciliationEngineWorker()` após Reconciliation Worker (30s) |
| Testes | `backend/tests/unit/reconciliation-engine.test.ts` |
| Tabela legada | `reconciliation_discrepancies` (0026) — coexistência temporária; **regra futura:** [RECONCILIATION_DISCREPANCY_DUAL_TABLE.md](../02_decisions/RECONCILIATION_DISCREPANCY_DUAL_TABLE.md) |
| Marker schema | `0055_reconciliation_discrepancies_legacy_marker.sql` (COMMENTS) |

## Detecções

1. **ledger_mismatch:** transação concluída — soma débitos ≠ créditos ou ≠ `amount_cents`
2. **orphan_transaction:** concluída sem linhas de ledger
3. **orphan_ledger_entry:** linha em `bank_ledger` com `transaction_id` NULL
4. **account_mismatch:** se `reconciliation_balance_cents` **NOT NULL** na conta → compara com Σ(credit − debit) no ledger

## Eventos (`logFinancialEvent`)

- `reconciliation_run_started`
- `reconciliation_discrepancy_detected` (por divergência)
- `reconciliation_run_completed` (metadata com `discrepanciesFound`)

## Worker existente (30s)

`reconciliation-worker.ts` permanece só com checagens read-only anteriores (intents/payouts/ledger global); **não** foi substituído.

## Drift migrations (fora desta fase)

Se `migrate` falhar em **0030** (`payment_intents` já existe): baseline de **`schema_migrations`** pendente — ver **[DRIFT_SCHEMA_MIGRATIONS_BASELINE_PENDENTE.md](../02_decisions/DRIFT_SCHEMA_MIGRATIONS_BASELINE_PENDENTE.md)** (janela de manutenção; **não** misturar com evolução estrutural).
