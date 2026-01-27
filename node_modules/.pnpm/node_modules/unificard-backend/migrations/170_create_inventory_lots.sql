-- ============================================================
-- UNIFICARD - MIGRATION 170
-- SPRINT 37.4: MARKETPLACE CORE - Lote & Validade (Opt-In)
-- Tabela: inventory_lots
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para rastreabilidade por lote e validade.
-- Lote é OPT-IN (não obrigatório para todos os produtos).
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Lote é OPT-IN (não obrigatório)
-- - Estoque sem lote continua funcionando
-- - Validade é informativa, não executiva
-- - Nenhuma decisão automática por validade
-- - Nenhuma integração com venda/pedido/pagamento
-- ============================================================

-- ============================================================
-- TABELA: inventory_lots
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_lots (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Variante de produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE CASCADE,
    
    -- Código do lote (único por variante)
    lot_code VARCHAR(255) NOT NULL,
    
    -- Data de fabricação (opcional)
    manufacture_date DATE,
    
    -- Data de validade (opcional)
    expiration_date DATE,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_lot_code_per_variant UNIQUE (tenant_id, product_variant_id, lot_code)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_inventory_lots_tenant
    ON inventory_lots (tenant_id);

-- Índice para buscar por variante
CREATE INDEX IF NOT EXISTS idx_inventory_lots_variant
    ON inventory_lots (tenant_id, product_variant_id);

-- Índice para busca por código de lote
CREATE INDEX IF NOT EXISTS idx_inventory_lots_code
    ON inventory_lots (tenant_id, product_variant_id, lot_code);

-- Índice para busca por validade (para consultas futuras)
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiration
    ON inventory_lots (tenant_id, expiration_date)
    WHERE expiration_date IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_lots_rls ON inventory_lots
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE inventory_lots IS
    'Lotes de produtos (opt-in). Permite rastreabilidade por lote e validade. Não obrigatório para todos os produtos.';

COMMENT ON COLUMN inventory_lots.lot_code IS
    'Código do lote (único por variante). Ex: LOTE-2024-001.';

COMMENT ON COLUMN inventory_lots.manufacture_date IS
    'Data de fabricação (opcional). Informativa.';

COMMENT ON COLUMN inventory_lots.expiration_date IS
    'Data de validade (opcional). Informativa, não executiva. Não bloqueia operações automaticamente.';

COMMENT ON COLUMN inventory_lots.metadata IS
    'Metadados adicionais do lote (JSONB). Puramente declarativo.';







