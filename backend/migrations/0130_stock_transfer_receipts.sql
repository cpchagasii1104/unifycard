-- 0130: stock_transfer_receipts + stock_transfer_receipt_items

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status') THEN
    CREATE TYPE receipt_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE stock_transfer_receipts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stock_transfer_id    UUID NOT NULL,
  received_by_user_id  UUID NOT NULL,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status               receipt_status NOT NULL DEFAULT 'IN_PROGRESS',
  notes                TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_receipts_transfer
    FOREIGN KEY (tenant_id, stock_transfer_id)
    REFERENCES stock_transfers(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX idx_stock_transfer_receipts_transfer
  ON stock_transfer_receipts (tenant_id, stock_transfer_id);

ALTER TABLE stock_transfer_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfer_receipts_rls ON stock_transfer_receipts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TABLE stock_transfer_receipt_items (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id               UUID NOT NULL REFERENCES stock_transfer_receipts(id) ON DELETE CASCADE,
  stock_transfer_item_id   UUID NOT NULL REFERENCES stock_transfer_items(id) ON DELETE RESTRICT,
  expected_quantity        NUMERIC(20,4) NOT NULL CHECK (expected_quantity >= 0),
  received_quantity        NUMERIC(20,4) NOT NULL CHECK (received_quantity >= 0),
  inventory_lot_id         UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  discrepancy_reason TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipt_items_receipt ON stock_transfer_receipt_items (tenant_id, receipt_id);

ALTER TABLE stock_transfer_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfer_receipt_items_rls ON stock_transfer_receipt_items
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMIT;
