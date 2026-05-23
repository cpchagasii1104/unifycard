-- Trilha de auditoria append-only do ciclo de disputas (reconciliation_disputes).
-- Sem UPDATE/DELETE na aplicação; SSOT auditável além de logs voláteis.

BEGIN;

CREATE TABLE reconciliation_dispute_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dispute_id UUID NOT NULL REFERENCES reconciliation_disputes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'dispute_created',
    'moved_to_under_review',
    'resolved',
    'reversed'
  )),
  actor_kind TEXT NOT NULL,
  actor_id UUID,
  from_status TEXT,
  to_status TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_dispute_events_dispute_id
  ON reconciliation_dispute_events (dispute_id);

CREATE INDEX idx_reconciliation_dispute_events_tenant_id
  ON reconciliation_dispute_events (tenant_id);

COMMENT ON TABLE reconciliation_dispute_events IS
  'Append-only: decisões de disputa; sem inferência automática no payload.';

COMMIT;
