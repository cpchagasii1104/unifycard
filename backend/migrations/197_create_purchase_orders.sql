-- ============================================================
-- UNIFICARD - MIGRATION 197
-- SPRINT 69: SUPPLIERS + PURCHASE ORDERS
-- Tabela: purchase_orders
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de Ordens de Compra (Purchase Orders) que:
-- - Representa pedidos de compra para fornecedores
-- - NÃO executa pagamentos
-- - NÃO emite fiscal
-- - Inventory entra apenas no RECEIVE
-- - É totalmente auditável
--
-- REGRAS:
-- - Append-only (status muda, mas registros não desaparecem)
-- - Status declarativos
-- - Audit em todas as mudanças
-- - Purchase Order NÃO é Order (marketplace)
-- ============================================================

-- ============================================================
-- ENUM: Purchase Order Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
    CREATE TYPE purchase_order_status AS ENUM (
      'DRAFT',        -- Rascunho
      'SUBMITTED',    -- Enviado ao fornecedor
      'RECEIVED',     -- Recebido (parcial ou total)
      'COMPLETED',    -- Completo (todos os itens recebidos)
      'CANCELLED'     -- Cancelado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Fornecedor
    supplier_id UUID NOT NULL
        REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Número da ordem (opcional, pode ser gerado)
    order_number VARCHAR(50),
    
    -- Status
    status purchase_order_status NOT NULL DEFAULT 'DRAFT',
    
    -- Datas
    order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE, -- Quando foi recebido (primeira vez)
    completed_at TIMESTAMP WITH TIME ZONE, -- Quando foi completado
    
    -- Localização de entrega (opcional)
    delivery_address TEXT,
    delivery_city VARCHAR(100),
    delivery_state VARCHAR(100),
    delivery_zip_code VARCHAR(20),
    
    -- Notas
    notes TEXT,
    internal_notes TEXT, -- Notas internas (não visíveis ao fornecedor)
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Submissão
    submitted_at TIMESTAMP WITH TIME ZONE,
    submitted_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    
    -- Cancelamento
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    cancellation_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_order_number_per_tenant UNIQUE (tenant_id, order_number)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id
    ON purchase_orders(tenant_id);

-- Índice para buscar por fornecedor
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier
    ON purchase_orders(tenant_id, supplier_id, status);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status
    ON purchase_orders(tenant_id, status, order_date);

-- Índice para buscar por número
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number
    ON purchase_orders(tenant_id, order_number)
    WHERE order_number IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem ordens do próprio tenant
CREATE POLICY purchase_orders_tenant_isolation
    ON purchase_orders
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_orders_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE purchase_orders IS 'Ordens de Compra. Append-only: status muda, mas registros não desaparecem. Purchase Order NÃO é Order (marketplace).';
COMMENT ON COLUMN purchase_orders.status IS 'Status da ordem: DRAFT, SUBMITTED, RECEIVED, COMPLETED, CANCELLED';
COMMENT ON COLUMN purchase_orders.order_number IS 'Número da ordem (opcional, único por tenant)';






