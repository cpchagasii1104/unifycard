-- ============================================================
-- UNIFICARD - MIGRATION 168
-- SPRINT 37.3: MARKETPLACE CORE - Estoque (Movimentação)
-- Tabela: inventory_movements
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de movimentações de estoque.
-- Movimentações são eventos append-only que representam entrada/saída/ajuste.
-- Saldo é SEMPRE derivado das movimentações, nunca editável.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Movimentações são APPEND-ONLY (sem UPDATE/DELETE)
-- - Saldo é DERIVADO, não editável
-- - quantity pode ser negativa apenas em ADJUSTMENT
-- - IN e OUT sempre positivos
-- - Nenhuma integração com venda/pedido/pagamento
-- ============================================================

-- ============================================================
-- ENUM: Tipo de movimentação
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
        CREATE TYPE inventory_movement_type AS ENUM (
            'IN',          -- Entrada (sempre positivo)
            'OUT',         -- Saída (sempre positivo)
            'ADJUSTMENT'   -- Ajuste (pode ser positivo ou negativo)
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: inventory_movements
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Variante de produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE CASCADE,
    
    -- Tipo de movimentação
    movement_type inventory_movement_type NOT NULL,
    
    -- Quantidade (numeric para suportar decimais em pesáveis)
    quantity NUMERIC(20, 4) NOT NULL,
    
    -- Unidade (ex: un, kg, g, l)
    unit VARCHAR(50) NOT NULL DEFAULT 'un',
    
    -- Motivo da movimentação
    reason VARCHAR(255),
    
    -- Referência externa (tipo e ID)
    reference_type VARCHAR(100),
    reference_id UUID,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Auditoria
    created_by_user_id UUID,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_quantity_positive_in_out CHECK (
        (movement_type IN ('IN', 'OUT') AND quantity > 0) OR
        (movement_type = 'ADJUSTMENT')
    )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice principal para cálculo de saldo
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_created
    ON inventory_movements (product_variant_id, created_at DESC);

-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_created
    ON inventory_movements (tenant_id, created_at DESC);

-- Índice para busca por tipo de movimentação
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type
    ON inventory_movements (tenant_id, movement_type);

-- Índice para busca por referência
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
    ON inventory_movements (tenant_id, reference_type, reference_id)
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_movements_rls ON inventory_movements
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Prevenir UPDATE/DELETE (Movimentações são imutáveis)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_inventory_movement_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'inventory_movements is immutable (append-only). UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Trigger para prevenir UPDATE
CREATE TRIGGER prevent_inventory_movements_update
    BEFORE UPDATE ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inventory_movement_modification();

-- Trigger para prevenir DELETE
CREATE TRIGGER prevent_inventory_movements_delete
    BEFORE DELETE ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inventory_movement_modification();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE inventory_movements IS
    'Movimentações de estoque (append-only). Fonte única da verdade para saldo. Saldo é sempre derivado, nunca editável.';

COMMENT ON COLUMN inventory_movements.movement_type IS
    'Tipo de movimentação: IN (entrada, sempre positivo), OUT (saída, sempre positivo), ADJUSTMENT (ajuste, pode ser negativo).';

COMMENT ON COLUMN inventory_movements.quantity IS
    'Quantidade movimentada. IN e OUT sempre positivos. ADJUSTMENT pode ser negativo.';

COMMENT ON COLUMN inventory_movements.reason IS
    'Motivo da movimentação (ex: purchase, loss, correction, sale). Puramente declarativo.';

COMMENT ON COLUMN inventory_movements.reference_type IS
    'Tipo de referência externa (ex: manual, order, transfer). Opcional.';

COMMENT ON COLUMN inventory_movements.reference_id IS
    'ID da referência externa. Opcional.';

COMMENT ON COLUMN inventory_movements.created_by_user_id IS
    'Usuário que criou a movimentação. Para auditoria.';







