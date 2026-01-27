-- ============================================================
-- UNIFICARD - MIGRATION 191
-- SPRINT 56: RECEBIMENTO COM CONFERÊNCIA E DIVERGÊNCIA
-- Tabelas: stock_transfer_receipts, stock_transfer_receipt_items
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para conferência de recebimento de transferências.
-- Permite registrar divergências (faltando, quantidade errada, lote errado, avaria).
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Receipt é append-only (histórico não é alterado)
-- - Divergência é informativa e auditável
-- - NÃO ajusta estoque automaticamente
-- - Decisão humana vem depois
-- ============================================================

-- ============================================================
-- ENUM: Status do recebimento
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transfer_receipt_status') THEN
        CREATE TYPE stock_transfer_receipt_status AS ENUM (
            'IN_PROGRESS',  -- Conferência em andamento
            'PARTIAL',      -- Recebido parcialmente (alguns itens divergentes)
            'COMPLETE',     -- Recebido completamente (tudo conforme)
            'REJECTED'      -- Rejeitado (não recebido)
        );
    END IF;
END $$;

-- ============================================================
-- ATUALIZAR ENUM: Status da transferência (adicionar RECEIVING)
-- ============================================================
-- Nota: PostgreSQL não permite alterar ENUM diretamente.
-- Vamos criar um novo tipo e migrar os dados.
DO $$
BEGIN
    -- Verificar se já existe RECEIVING no enum atual
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'RECEIVING'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stock_transfer_status')
    ) THEN
        -- Adicionar RECEIVING diretamente ao enum existente (PostgreSQL 9.1+)
        ALTER TYPE stock_transfer_status ADD VALUE IF NOT EXISTS 'RECEIVING' AFTER 'SHIPPED';
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore se o valor já existe ou o enum não existe
    NULL;
END $$;

-- ============================================================
-- TABELA: stock_transfer_receipts
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfer_receipts (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Transferência associada
    stock_transfer_id UUID NOT NULL
        REFERENCES stock_transfers(id) ON DELETE RESTRICT,
    
    -- Usuário que fez a conferência
    received_by_user_id UUID NOT NULL,
    
    -- Data de recebimento
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Status do recebimento
    status stock_transfer_receipt_status NOT NULL DEFAULT 'IN_PROGRESS',
    
    -- Observações/notas
    notes TEXT,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: stock_transfer_receipt_items
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfer_receipt_items (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Receipt associado
    receipt_id UUID NOT NULL
        REFERENCES stock_transfer_receipts(id) ON DELETE CASCADE,
    
    -- Item da transferência
    stock_transfer_item_id UUID NOT NULL
        REFERENCES stock_transfer_items(id) ON DELETE RESTRICT,
    
    -- Quantidade esperada (do item original)
    expected_quantity NUMERIC(20, 4) NOT NULL CHECK (expected_quantity > 0),
    
    -- Quantidade recebida (física)
    received_quantity NUMERIC(20, 4) NOT NULL CHECK (received_quantity >= 0),
    
    -- Lote recebido (pode ser diferente do esperado)
    inventory_lot_id UUID
        REFERENCES inventory_lots(id) ON DELETE SET NULL,
    
    -- Motivo da divergência (opcional)
    discrepancy_reason TEXT,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipts_tenant
    ON stock_transfer_receipts (tenant_id);

-- Índice para buscar por transferência
CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipts_transfer
    ON stock_transfer_receipts (tenant_id, stock_transfer_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipts_status
    ON stock_transfer_receipts (tenant_id, status);

-- Índice para buscar itens por receipt
CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipt_items_receipt
    ON stock_transfer_receipt_items (tenant_id, receipt_id);

-- Índice para buscar itens por transfer item
CREATE INDEX IF NOT EXISTS idx_stock_transfer_receipt_items_transfer_item
    ON stock_transfer_receipt_items (tenant_id, stock_transfer_item_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE stock_transfer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfer_receipts_rls ON stock_transfer_receipts
    USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY stock_transfer_receipt_items_rls ON stock_transfer_receipt_items
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Prevenir DELETE (append-only)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_stock_transfer_receipt_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'stock_transfer_receipts e stock_transfer_receipt_items são append-only. DELETE não permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_stock_transfer_receipts_delete
    BEFORE DELETE ON stock_transfer_receipts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_transfer_receipt_delete();

CREATE TRIGGER prevent_stock_transfer_receipt_items_delete
    BEFORE DELETE ON stock_transfer_receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_transfer_receipt_delete();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE stock_transfer_receipts IS
    'Conferência de recebimento de transferências. Permite registrar divergências. Append-only.';

COMMENT ON COLUMN stock_transfer_receipts.status IS
    'Status: IN_PROGRESS (conferência em andamento), PARTIAL (recebido parcialmente), COMPLETE (recebido completamente), REJECTED (rejeitado).';

COMMENT ON COLUMN stock_transfer_receipts.notes IS
    'Observações sobre o recebimento (divergências, avarias, etc.).';

COMMENT ON TABLE stock_transfer_receipt_items IS
    'Itens conferidos do recebimento. Compara quantidade esperada vs recebida.';

COMMENT ON COLUMN stock_transfer_receipt_items.expected_quantity IS
    'Quantidade esperada (do item original da transferência).';

COMMENT ON COLUMN stock_transfer_receipt_items.received_quantity IS
    'Quantidade recebida (física, pode ser diferente da esperada).';

COMMENT ON COLUMN stock_transfer_receipt_items.discrepancy_reason IS
    'Motivo da divergência (opcional). Ex: "Faltando 2 unidades", "Lote errado", "Avaria".';







