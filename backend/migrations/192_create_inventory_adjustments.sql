-- ============================================================
-- UNIFICARD - MIGRATION 192
-- SPRINT 57: AJUSTES DE ESTOQUE (AVARIA, PERDA, SOBRA)
-- Tabela: inventory_adjustments
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para ajustes explícitos de estoque.
-- Permite registrar perdas, avarias e sobras de forma auditável.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Ajuste é append-only (histórico não é alterado)
-- - Ajuste gera inventory_movement ADJUSTMENT
-- - Ajuste nunca apaga nem corrige movimento anterior
-- - NÃO automatiza após conferência
-- - Decisão humana vem antes
-- ============================================================

-- ============================================================
-- ENUM: Tipo de ajuste
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_adjustment_type') THEN
        CREATE TYPE inventory_adjustment_type AS ENUM (
            'LOSS',     -- Perda (quantidade negativa)
            'DAMAGE',   -- Avaria (quantidade negativa)
            'SURPLUS'   -- Sobra (quantidade positiva)
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Tipo de referência do ajuste
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_adjustment_reference_type') THEN
        CREATE TYPE inventory_adjustment_reference_type AS ENUM (
            'RECEIPT',  -- Referência a stock_transfer_receipt
            'MANUAL'    -- Ajuste manual (não referenciado)
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: inventory_adjustments
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Unidade organizacional (actor)
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Variante do produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Lote (opcional)
    inventory_lot_id UUID
        REFERENCES inventory_lots(id) ON DELETE SET NULL,
    
    -- Tipo de ajuste
    adjustment_type inventory_adjustment_type NOT NULL,
    
    -- Quantidade (signed)
    -- LOSS/DAMAGE → negativa
    -- SURPLUS → positiva
    quantity NUMERIC(20, 4) NOT NULL,
    
    -- Motivo do ajuste
    reason TEXT NOT NULL,
    
    -- Tipo de referência
    reference_type inventory_adjustment_reference_type,
    
    -- ID da referência (opcional)
    reference_id UUID,
    
    -- Usuário que criou o ajuste
    created_by_user_id UUID NOT NULL,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_tenant
    ON inventory_adjustments (tenant_id);

-- Índice para buscar por actor
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_actor
    ON inventory_adjustments (tenant_id, actor_id);

-- Índice para buscar por variante
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_variant
    ON inventory_adjustments (tenant_id, product_variant_id);

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_type
    ON inventory_adjustments (tenant_id, adjustment_type);

-- Índice para buscar por referência
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_reference
    ON inventory_adjustments (tenant_id, reference_type, reference_id)
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- Índice composto para listagem comum
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_actor_created
    ON inventory_adjustments (tenant_id, actor_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_adjustments_rls ON inventory_adjustments
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Prevenir DELETE (append-only)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_inventory_adjustment_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'inventory_adjustments é append-only. DELETE não permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_inventory_adjustments_delete
    BEFORE DELETE ON inventory_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inventory_adjustment_delete();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE inventory_adjustments IS
    'Ajustes explícitos de estoque (perda, avaria, sobra). Append-only, auditável.';

COMMENT ON COLUMN inventory_adjustments.actor_id IS
    'Unidade organizacional onde o ajuste ocorreu.';

COMMENT ON COLUMN inventory_adjustments.adjustment_type IS
    'Tipo: LOSS (perda, quantidade negativa), DAMAGE (avaria, quantidade negativa), SURPLUS (sobra, quantidade positiva).';

COMMENT ON COLUMN inventory_adjustments.quantity IS
    'Quantidade ajustada (signed). LOSS/DAMAGE → negativa, SURPLUS → positiva.';

COMMENT ON COLUMN inventory_adjustments.reason IS
    'Motivo do ajuste (obrigatório). Ex: "Avaria após transporte", "Perda por validade", "Sobra encontrada".';

COMMENT ON COLUMN inventory_adjustments.reference_type IS
    'Tipo de referência: RECEIPT (referência a stock_transfer_receipt), MANUAL (ajuste manual).';

COMMENT ON COLUMN inventory_adjustments.reference_id IS
    'ID da referência (opcional). Se reference_type = RECEIPT, aponta para stock_transfer_receipt.id.';







