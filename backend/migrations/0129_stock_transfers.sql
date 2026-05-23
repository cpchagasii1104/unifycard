-- 0129: stock_transfers + stock_transfer_items

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transfer_status') THEN
    CREATE TYPE stock_transfer_status AS ENUM (
      'DRAFT', 'PENDING', 'SHIPPED', 'RECEIVED', 'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE stock_transfers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_actor_id         UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  to_actor_id           UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  status                stock_transfer_status NOT NULL DEFAULT 'DRAFT',
  requested_by_user_id  UUID,
  shipped_at            TIMESTAMPTZ,
  received_at           TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_transfers_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT chk_stock_transfers_different_actors CHECK (from_actor_id != to_actor_id)
);

CREATE INDEX idx_stock_transfers_tenant ON stock_transfers (tenant_id);
CREATE INDEX idx_stock_transfers_from   ON stock_transfers (tenant_id, from_actor_id);
CREATE INDEX idx_stock_transfers_to     ON stock_transfers (tenant_id, to_actor_id);
CREATE INDEX idx_stock_transfers_status ON stock_transfers (tenant_id, status);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfers_rls ON stock_transfers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION stock_transfers_bump_updated_at()
RETURNS TRIGGER SET search_path = pg_catalog, pg_temp LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_stock_transfers_updated_at
  BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION stock_transfers_bump_updated_at();

CREATE TABLE stock_transfer_items (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stock_transfer_id    UUID NOT NULL,
  product_variant_id   UUID NOT NULL,
  quantity             NUMERIC(20,4) NOT NULL CHECK (quantity > 0),
  inventory_lot_id     UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stock_transfer_items_transfer
    FOREIGN KEY (tenant_id, stock_transfer_id)
    REFERENCES stock_transfers(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_transfer_items_variant
    FOREIGN KEY (tenant_id, product_variant_id)
    REFERENCES product_variants(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX idx_stock_transfer_items_transfer
  ON stock_transfer_items (tenant_id, stock_transfer_id);

CREATE INDEX idx_stock_transfer_items_variant
  ON stock_transfer_items (tenant_id, product_variant_id);

ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfer_items_rls ON stock_transfer_items
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMIT;
