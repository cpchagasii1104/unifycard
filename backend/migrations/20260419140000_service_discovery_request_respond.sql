-- ============================================================
-- Upgrade: pedidos criados antes do alinhamento (requested/cancelled)
-- → pending/rejected; garantir responded_at e constraint final.
-- Instalações novas já vêm corretas em 20260419130000.
-- ============================================================

BEGIN;

ALTER TABLE service_discovery_requests
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

UPDATE service_discovery_requests
SET status = 'pending'
WHERE status = 'requested';

UPDATE service_discovery_requests
SET status = 'rejected'
WHERE status = 'cancelled';

ALTER TABLE service_discovery_requests
  DROP CONSTRAINT IF EXISTS service_discovery_requests_status_check;

ALTER TABLE service_discovery_requests
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE service_discovery_requests
  ADD CONSTRAINT service_discovery_requests_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected'));

COMMENT ON COLUMN service_discovery_requests.responded_at IS
  'Preenchido quando o prestador aceita ou recusa o pedido.';

COMMIT;
