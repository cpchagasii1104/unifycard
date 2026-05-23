-- Prompt 52 — Reconciliation Engine (constitucional: leitura/diagnóstico; sem alterar ledger/transactions)

BEGIN;

CREATE TABLE reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  discrepancies_found INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_reconciliation_runs_tenant_started
  ON reconciliation_runs (tenant_id, started_at DESC);

COMMENT ON TABLE reconciliation_runs IS 'Prompt 52: execuções de reconciliação ledger/transactions/accounts (somente diagnóstico).';

CREATE TABLE reconciliation_ledger_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reconciliation_run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'ledger_mismatch',
    'account_mismatch',
    'orphan_transaction',
    'orphan_ledger_entry'
  )),
  reference_id UUID NOT NULL,
  expected_value_cents BIGINT,
  actual_value_cents BIGINT,
  difference_cents BIGINT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolution_notes TEXT
);

CREATE INDEX idx_recon_ledger_disc_tenant_resolved
  ON reconciliation_ledger_discrepancies (tenant_id, resolved);
CREATE INDEX idx_recon_ledger_disc_run
  ON reconciliation_ledger_discrepancies (reconciliation_run_id);

COMMENT ON TABLE reconciliation_ledger_discrepancies IS 'Prompt 52: divergências detectadas; correção só via fluxo formal (transfer/reversal).';

COMMIT;
