-- 0041_ledger_snapshots.sql
-- Snapshots periódicos do saldo por conta (auditoria e performance). Não altera bank_transactions nem bank_ledger.

CREATE TABLE ledger_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  balance_cents BIGINT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ledger_snapshots_tenant_account_snapshot
  ON ledger_snapshots (tenant_id, account_id, snapshot_at);

CREATE INDEX idx_ledger_snapshots_snapshot_at
  ON ledger_snapshots (snapshot_at DESC);

COMMENT ON TABLE ledger_snapshots IS 'Snapshots de saldo por conta (read-only do bank_ledger). Não altera bank_transactions nem bank_ledger.';
