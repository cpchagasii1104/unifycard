-- backend/migrations/235_create_tab_orders.sql
-- SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

-- ============================================================
-- TABELA: tab_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT tab_orders_unique_pair UNIQUE (tenant_id, tab_id, order_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tab_orders_tenant_tab ON tab_orders(tenant_id, tab_id);
CREATE INDEX IF NOT EXISTS idx_tab_orders_tenant_order ON tab_orders(tenant_id, order_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE tab_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tab_orders_tenant_isolation ON tab_orders FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





