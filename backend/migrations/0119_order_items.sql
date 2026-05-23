BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'orders'::regclass
      AND conname = 'orders_tenant_id_id_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_tenant_id_id_key UNIQUE (tenant_id, id);
  END IF;
END $$;

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  product_variant_id UUID NOT NULL
    REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity NUMERIC(20,4) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL DEFAULT 'un',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_order_items_order_tenant
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES orders(tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_order_items_order ON order_items (tenant_id, order_id);
CREATE INDEX idx_order_items_variant ON order_items (tenant_id, product_variant_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_rls ON order_items
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION prevent_order_items_delete()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'order_items: DELETE não permitido (auditoria de pedidos).';
END;
$$;

CREATE TRIGGER prevent_order_items_delete
  BEFORE DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION prevent_order_items_delete();

COMMIT;
