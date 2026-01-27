-- backend/migrations/233_create_menus.sql
-- SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

-- ============================================================
-- TABELA: menus
-- ============================================================
CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: menu_items
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_menus_tenant_actor ON menus(tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_menus_tenant_active ON menus(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_product_variant_id ON menu_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort_order ON menu_items(menu_id, sort_order);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY menus_tenant_isolation ON menus FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Adicionar coluna tenant_id em menu_items se não existir (ANTES de criar RLS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'tenant_id') THEN
        ALTER TABLE menu_items ADD COLUMN tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;
    END IF;
END$$;

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY menu_items_tenant_isolation ON menu_items FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id')::UUID
);

-- Trigger para garantir tenant_id em menu_items via menu
CREATE OR REPLACE FUNCTION set_menu_items_tenant_id() RETURNS TRIGGER AS $$
BEGIN
    NEW.tenant_id = (SELECT tenant_id FROM menus WHERE id = NEW.menu_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_menu_items_tenant_id
    BEFORE INSERT ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION set_menu_items_tenant_id();

