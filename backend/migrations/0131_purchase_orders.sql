-- 0131: purchase_orders + purchase_order_items

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
    CREATE TYPE purchase_order_status AS ENUM (
      'DRAFT', 'SUBMITTED', 'CONFIRMED',
      'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'COMPLETED'
    );
  END IF;
END $$;

CREATE TABLE purchase_orders (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id             UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  order_number            VARCHAR(100),
  status                  purchase_order_status NOT NULL DEFAULT 'DRAFT',
  order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date  DATE,
  received_at             TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  delivery_address        TEXT,
  delivery_city           TEXT,
  delivery_state          TEXT,
  delivery_zip_code       VARCHAR(20),
  notes                   TEXT,
  internal_notes          TEXT,
  created_by_actor_id     UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  created_by_user_id      UUID,
  submitted_at            TIMESTAMPTZ,
  submitted_by_actor_id   UUID,
  cancelled_at            TIMESTAMPTZ,
  cancelled_by_actor_id   UUID,
  cancellation_reason     TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT purchase_orders_tenant_id_id_key UNIQUE (tenant_id, id)
);

CREATE INDEX idx_purchase_orders_tenant   ON purchase_orders (tenant_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders (tenant_id, supplier_id);
CREATE INDEX idx_purchase_orders_status   ON purchase_orders (tenant_id, status);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchase_orders_rls ON purchase_orders
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION purchase_orders_bump_updated_at()
RETURNS TRIGGER SET search_path = pg_catalog, pg_temp LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION purchase_orders_bump_updated_at();

CREATE TABLE purchase_order_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id     UUID NOT NULL,
  product_variant_id    UUID NOT NULL,
  quantity_ordered      NUMERIC(20,4) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received     NUMERIC(20,4) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit                  VARCHAR(50) NOT NULL DEFAULT 'un',
  unit_price_cents      BIGINT CHECK (unit_price_cents >= 0),
  currency              TEXT NOT NULL DEFAULT 'BRL',
  total_price_cents     BIGINT CHECK (total_price_cents >= 0),
  notes                 TEXT,
  created_by_actor_id   UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  created_by_user_id    UUID,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_po_items_order
    FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES purchase_orders(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_po_items_variant
    FOREIGN KEY (tenant_id, product_variant_id)
    REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX idx_po_items_order   ON purchase_order_items (tenant_id, purchase_order_id);
CREATE INDEX idx_po_items_variant ON purchase_order_items (tenant_id, product_variant_id);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchase_order_items_rls ON purchase_order_items
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION purchase_order_items_bump_updated_at()
RETURNS TRIGGER SET search_path = pg_catalog, pg_temp LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_po_items_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION purchase_order_items_bump_updated_at();

COMMIT;
