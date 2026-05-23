-- ============================================================
-- 0106: inventory_reservations (soft hold — não altera movements)
-- ============================================================
-- Pré-requisitos: 0002 tenants, 0004 orders, 0101 product_variants
-- Reconciliação: archive 0613 — tenants(id), FKs compostas tenant+order / tenant+variante
-- Colunas camelCase alinhadas a inventory-reservation.repository.ts
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'inventory_reservation_status'
  ) THEN
    CREATE TYPE inventory_reservation_status AS ENUM (
      'ACTIVE',
      'RELEASED',
      'CONSUMED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'inventory_reservation_source'
  ) THEN
    CREATE TYPE inventory_reservation_source AS ENUM (
      'MARKETPLACE',
      'PDV'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'orders'::regclass
      AND conname = 'orders_tenant_id_id_key'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_tenant_id_id_key UNIQUE (tenant_id, id);
  END IF;
END $$;

CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL,
  quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
  order_id UUID NOT NULL,
  source inventory_reservation_source NOT NULL,
  status inventory_reservation_status NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_inventory_reservations_variant_tenant
    FOREIGN KEY (tenant_id, product_variant_id)
    REFERENCES product_variants(tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_reservations_order_tenant
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES orders(tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_inventory_reservations_tenant ON inventory_reservations (tenant_id);

CREATE INDEX idx_inventory_reservations_variant ON inventory_reservations (tenant_id, product_variant_id);

CREATE INDEX idx_inventory_reservations_order ON inventory_reservations (tenant_id, order_id);

CREATE INDEX idx_inventory_reservations_active ON inventory_reservations (tenant_id, product_variant_id, status)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_inventory_reservations_expires ON inventory_reservations (tenant_id, status, "expiresAt")
  WHERE status = 'ACTIVE' AND "expiresAt" IS NOT NULL;

ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_reservations_rls ON inventory_reservations
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION inventory_reservations_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_reservations_updated_at
  BEFORE UPDATE ON inventory_reservations
  FOR EACH ROW
  EXECUTE FUNCTION inventory_reservations_bump_updated_at();

CREATE OR REPLACE FUNCTION prevent_inventory_reservation_delete()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'inventory_reservations: DELETE não permitido (auditoria / histórico de reservas).';
END;
$$;

CREATE TRIGGER inventory_reservations_prevent_delete
  BEFORE DELETE ON inventory_reservations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_inventory_reservation_delete();

COMMENT ON TABLE inventory_reservations IS
  'Reserva lógica (soft hold). Não altera inventory_movements nem saldo físico; status ACTIVE|RELEASED|CONSUMED.';

COMMENT ON COLUMN inventory_reservations."expiresAt" IS
  'Opcional; reservas ACTIVE com expiresAt no passado devem ser tratadas como inválidas na aplicação.';

COMMIT;
