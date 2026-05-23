-- §15.1 — Alinhar event_idempotency_tracking ao padrão RLS do sistema (ex.: inventory_movements).
-- Pré-requisito: 20260331120000_event_idempotency_tracking

BEGIN;

ALTER TABLE event_idempotency_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_idempotency_tracking_rls ON event_idempotency_tracking;

CREATE POLICY event_idempotency_tracking_rls ON event_idempotency_tracking
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMENT ON POLICY event_idempotency_tracking_rls ON event_idempotency_tracking IS
  'Isolamento por tenant via app.current_tenant (runQueryWithTenant).';

COMMIT;
