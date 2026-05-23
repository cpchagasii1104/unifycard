-- ============================================================
-- 0107: fulfillment_orders (execução física do pedido)
-- ============================================================
-- Pré-requisitos: 0002 tenants, 0004 orders, 0106 (orders_tenant_id_id_key)
-- Reconciliação: archive 0625 (parte orders) — tenants(id), FK composta order,
--   timestamps/metadata alinhados a fulfillment.repository.ts
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_source') THEN
    CREATE TYPE fulfillment_source AS ENUM ('PDV', 'MARKETPLACE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status') THEN
    CREATE TYPE fulfillment_status AS ENUM (
      'PENDING',
      'PICKED',
      'SHIPPED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE fulfillment_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  source fulfillment_source NOT NULL,
  status fulfillment_status NOT NULL DEFAULT 'PENDING',
  picked_by_user_id UUID,
  "shippedAt" TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_fulfillment_per_order UNIQUE (tenant_id, order_id),
  CONSTRAINT fulfillment_orders_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT fk_fulfillment_orders_order_tenant
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES orders(tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_fulfillment_orders_tenant ON fulfillment_orders (tenant_id);

CREATE INDEX idx_fulfillment_orders_order ON fulfillment_orders (tenant_id, order_id);

CREATE INDEX idx_fulfillment_orders_status ON fulfillment_orders (tenant_id, status);

CREATE INDEX idx_fulfillment_orders_status_created ON fulfillment_orders (tenant_id, status, "createdAt" DESC);

ALTER TABLE fulfillment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY fulfillment_orders_rls ON fulfillment_orders
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION fulfillment_orders_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fulfillment_orders_updated_at
  BEFORE UPDATE ON fulfillment_orders
  FOR EACH ROW
  EXECUTE FUNCTION fulfillment_orders_bump_updated_at();

CREATE OR REPLACE FUNCTION prevent_fulfillment_orders_delete()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'fulfillment_orders: DELETE não permitido.';
END;
$$;

CREATE TRIGGER prevent_fulfillment_orders_delete
  BEFORE DELETE ON fulfillment_orders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_fulfillment_orders_delete();

COMMENT ON TABLE fulfillment_orders IS
  'Fulfillment: picking/envio. 1 registo por (tenant, order). Baixa física de estoque só após confirmação operacional (ex.: SHIPPED + movement OUT na aplicação).';

COMMENT ON COLUMN fulfillment_orders."shippedAt" IS
  'Preenchido quando envio confirmado; não substitui registo em inventory_movements.';

COMMIT;
