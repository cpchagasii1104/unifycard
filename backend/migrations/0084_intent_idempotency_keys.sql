-- ============================================================
-- 0084: Idempotência persistente (intent.execute / checkout)
-- ============================================================

BEGIN;

CREATE TABLE idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  key text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

CREATE INDEX idx_idempotency_keys_tenant_created ON idempotency_keys (tenant_id, created_at);

COMMIT;
