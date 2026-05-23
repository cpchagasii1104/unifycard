-- ============================================================
-- 0108: fulfillment_items
-- ============================================================
-- Pré-requisitos: 0107 fulfillment_orders, 0101 product_variants, 0104 inventory_lots
-- Reconciliação: archive 0625 (parte items) — FKs compostas, camelCase como o repo
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_item_status') THEN
    CREATE TYPE fulfillment_item_status AS ENUM ('PENDING', 'PICKED');
  END IF;
END $$;

CREATE TABLE fulfillment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  fulfillment_order_id UUID NOT NULL,
  product_variant_id UUID NOT NULL,
  quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
  inventory_lot_id UUID
    REFERENCES inventory_lots(id) ON DELETE SET NULL,
  status fulfillment_item_status NOT NULL DEFAULT 'PENDING',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_fulfillment_items_order_tenant
    FOREIGN KEY (tenant_id, fulfillment_order_id)
    REFERENCES fulfillment_orders(tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_fulfillment_items_variant_tenant
    FOREIGN KEY (tenant_id, product_variant_id)
    REFERENCES product_variants(tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_fulfillment_items_fulfillment ON fulfillment_items (tenant_id, fulfillment_order_id);

CREATE INDEX idx_fulfillment_items_variant ON fulfillment_items (tenant_id, product_variant_id);

CREATE INDEX idx_fulfillment_items_pending ON fulfillment_items (tenant_id, fulfillment_order_id, status)
  WHERE status = 'PENDING';

ALTER TABLE fulfillment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY fulfillment_items_rls ON fulfillment_items
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION validate_fulfillment_item_lot_variant()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.inventory_lot_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM inventory_lots il
    WHERE il.id = NEW.inventory_lot_id
      AND il.tenant_id = NEW.tenant_id
      AND il.product_variant_id = NEW.product_variant_id
  ) THEN
    RAISE EXCEPTION
      'fulfillment_items.inventory_lot_id % não pertence ao par tenant/variante da linha',
      NEW.inventory_lot_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_fulfillment_item_lot_variant
  BEFORE INSERT OR UPDATE OF inventory_lot_id, product_variant_id, tenant_id
  ON fulfillment_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_fulfillment_item_lot_variant();

CREATE OR REPLACE FUNCTION prevent_fulfillment_items_delete()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'fulfillment_items: DELETE não permitido.';
END;
$$;

CREATE TRIGGER prevent_fulfillment_items_delete
  BEFORE DELETE ON fulfillment_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_fulfillment_items_delete();

COMMENT ON TABLE fulfillment_items IS
  'Linhas de picking/envio por variante; lote opcional com mesma regra de coerência que inventory_movements.';

COMMIT;
