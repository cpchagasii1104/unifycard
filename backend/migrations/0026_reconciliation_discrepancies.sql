-- 0026_reconciliation_discrepancies.sql
-- LEGADO: divergências gateway/bank/settlement (não é o motor Prompt 52).
-- Canônico ledger/transactions: reconciliation_ledger_discrepancies (0053). Ver docs/02_decisions/RECONCILIATION_DISCREPANCY_DUAL_TABLE.md
-- Correção sempre via adjustment transaction; nunca UPDATE/DELETE no ledger.

CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN ('gateway', 'bank', 'settlement')),
  reference_id TEXT NOT NULL,
  reference_type TEXT,
  expected_amount_cents BIGINT NOT NULL,
  actual_amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolution_note TEXT,
  adjustment_transaction_id UUID REFERENCES bank_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_tenant
  ON reconciliation_discrepancies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_type
  ON reconciliation_discrepancies(type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_status
  ON reconciliation_discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_created
  ON reconciliation_discrepancies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_reference
  ON reconciliation_discrepancies(tenant_id, reference_type, reference_id);

COMMENT ON TABLE reconciliation_discrepancies IS 'Divergências detectadas entre ledger, gateway e banco. Resolução apenas via adjustment transaction.';
