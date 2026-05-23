-- ============================================================
-- Solicitações do fluxo mínimo de descoberta de serviços
-- (oferta = linha em services; este registo = pedido do cliente)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS service_discovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services (service_id) ON DELETE CASCADE,
  customer_actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  requested_start TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_discovery_requests_tenant
  ON service_discovery_requests (tenant_id);

CREATE INDEX IF NOT EXISTS idx_service_discovery_requests_service
  ON service_discovery_requests (tenant_id, service_id);

CREATE INDEX IF NOT EXISTS idx_service_discovery_requests_customer
  ON service_discovery_requests (tenant_id, customer_actor_id);

ALTER TABLE service_discovery_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'service_discovery_requests'
      AND policyname = 'service_discovery_requests_rls'
  ) THEN
    CREATE POLICY service_discovery_requests_rls ON service_discovery_requests
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

COMMENT ON TABLE service_discovery_requests IS
  'Pedido simples de serviço (MVP descoberta); não substitui service_orders nem pagamentos.';

COMMIT;
