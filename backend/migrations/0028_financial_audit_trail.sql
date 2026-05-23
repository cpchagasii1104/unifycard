-- 0028_financial_audit_trail.sql
-- Trilha de auditoria financeira (não substitui o ledger).

CREATE TABLE financial_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  transaction_id UUID,
  account_id UUID,
  actor_id UUID,
  amount_cents BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_financial_audit_tenant
ON financial_audit_trail(tenant_id);

CREATE INDEX idx_financial_audit_transaction
ON financial_audit_trail(transaction_id);
