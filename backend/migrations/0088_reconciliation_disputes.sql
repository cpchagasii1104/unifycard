-- Disputas ligadas exclusivamente a reconciliation_ledger_discrepancies (Prompt 52/53).
-- SSOT de divergência: reconciliation_ledger_discrepancies. Sem auto-criação; sem tabela legada.

BEGIN;

CREATE TABLE reconciliation_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ledger_discrepancy_id UUID NOT NULL REFERENCES reconciliation_ledger_discrepancies(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open', 'under_review', 'resolved', 'reversed')),
  created_by_kind TEXT NOT NULL CHECK (created_by_kind IN ('system', 'admin', 'support')),
  created_by_actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_reconciliation_disputes_ledger_discrepancy UNIQUE (ledger_discrepancy_id)
);

CREATE INDEX idx_reconciliation_disputes_tenant_status
  ON reconciliation_disputes (tenant_id, status);

COMMENT ON TABLE reconciliation_disputes IS
  'Disputa explícita a partir de reconciliation_ledger_discrepancies; criação só via mutação autorizada; sem auto-disparo.';

COMMIT;
