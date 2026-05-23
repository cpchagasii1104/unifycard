-- Pedidos B2B entre tenants; movimentação física via inventory_movements (SSOT).
-- Sem ledger nesta fase.
BEGIN;

CREATE TABLE IF NOT EXISTS b2b_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  buyer_tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  supplier_tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'confirmed',
        'shipped',
        'delivered',
        'cancelled'
      )
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT b2b_orders_buyer_ne_supplier CHECK (buyer_tenant_id <> supplier_tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_buyer ON b2b_orders (buyer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_supplier ON b2b_orders (supplier_tenant_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_status ON b2b_orders (status);

CREATE TABLE IF NOT EXISTS b2b_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  b2b_order_id UUID NOT NULL REFERENCES b2b_orders (id) ON DELETE CASCADE,
  canonical_product_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_order_items_order ON b2b_order_items (b2b_order_id);
CREATE INDEX IF NOT EXISTS idx_b2b_order_items_canonical ON b2b_order_items (canonical_product_id);

COMMENT ON TABLE b2b_orders IS 'Pedidos B2B entre tenants; fluxo físico + Bank fase 1 em migrations posteriores.';
COMMENT ON TABLE b2b_order_items IS 'Linhas B2B; canonical_product_id para resolução de variantes fornecedor/comprador.';

COMMIT;
