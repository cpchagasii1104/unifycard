-- 0055 — Marcação normativa legado vs canônico (sem alterar dados; sem condicionais).

BEGIN;

COMMENT ON TABLE reconciliation_discrepancies IS
  'LEGADO 0026: divergências gateway/bank/settlement. Não é o destino do Reconciliation Engine (Prompt 52). '
  'Canônico para ledger/transactions/accounts: reconciliation_ledger_discrepancies + reconciliation_runs. '
  'Convergir ou descontinuar — docs/02_decisions/RECONCILIATION_DISCREPANCY_DUAL_TABLE.md';

COMMENT ON TABLE reconciliation_ledger_discrepancies IS
  'Canônico Prompt 52: divergências bank_ledger / bank_transactions / contas; amarradas a reconciliation_runs.';

COMMIT;
