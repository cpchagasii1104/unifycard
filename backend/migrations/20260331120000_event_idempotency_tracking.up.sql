-- §15.1 — Event handler idempotency (orchestrator / workers)
-- Aligned with backend/src/core/events/idempotency-tracker.ts
-- ON CONFLICT (tenant_id, event_id, handler_name)

BEGIN;

CREATE TABLE IF NOT EXISTS event_idempotency_tracking (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  handler_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  result_status TEXT NOT NULL CHECK (result_status IN ('success', 'error', 'skipped')),
  result_data JSONB,
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_idempotency_tracking_unique_event_handler UNIQUE (tenant_id, event_id, handler_name)
);

CREATE INDEX IF NOT EXISTS idx_event_idempotency_tracking_tenant_created
  ON event_idempotency_tracking (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_idempotency_tracking_tenant_event
  ON event_idempotency_tracking (tenant_id, event_id);

COMMENT ON TABLE event_idempotency_tracking IS 'One row per (tenant, event_id, handler_name); prevents duplicate side effects from event replay.';

COMMIT;
