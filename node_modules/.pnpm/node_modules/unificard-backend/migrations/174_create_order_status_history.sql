-- ============================================================
-- UNIFICARD - MIGRATION 174
-- SPRINT 38.2: MARKETPLACE EXECUÇÃO - Order Lifecycle
-- Tabela: order_status_history
-- ============================================================
--
-- OBJETIVO:
-- Criar histórico de mudanças de status de pedidos.
-- Histórico é append-only e auditável.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Histórico é APPEND-ONLY (sem UPDATE/DELETE)
-- - Cada mudança de status gera registro
-- - Nenhuma execução ocorre (apenas registro)
-- ============================================================

-- ============================================================
-- TABELA: order_status_history
-- ============================================================
CREATE TABLE IF NOT EXISTS order_status_history (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pedido
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Status anterior
    from_status order_status,
    
    -- Status novo
    to_status order_status NOT NULL,
    
    -- Usuário que fez a mudança
    changed_by_user_id UUID,
    
    -- Motivo da mudança (opcional)
    reason TEXT,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar histórico de um pedido
CREATE INDEX IF NOT EXISTS idx_order_status_history_order
    ON order_status_history (order_id, created_at DESC);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_order_status_history_status
    ON order_status_history (to_status, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- RLS será herdado do pedido (via tenant_id do order)
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Policy baseada no tenant do pedido
CREATE POLICY order_status_history_rls ON order_status_history
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_status_history.order_id
              AND orders.tenant_id::text = current_setting('app.current_tenant', true)
        )
    );

-- ============================================================
-- TRIGGER: Prevenir UPDATE/DELETE (Histórico é imutável)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_order_status_history_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'order_status_history is immutable (append-only). UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Trigger para prevenir UPDATE
CREATE TRIGGER prevent_order_status_history_update
    BEFORE UPDATE ON order_status_history
    FOR EACH ROW
    EXECUTE FUNCTION prevent_order_status_history_modification();

-- Trigger para prevenir DELETE
CREATE TRIGGER prevent_order_status_history_delete
    BEFORE DELETE ON order_status_history
    FOR EACH ROW
    EXECUTE FUNCTION prevent_order_status_history_modification();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE order_status_history IS
    'Histórico de mudanças de status de pedidos (append-only). Cada mudança gera registro auditável.';

COMMENT ON COLUMN order_status_history.from_status IS
    'Status anterior (NULL para primeira mudança).';

COMMENT ON COLUMN order_status_history.to_status IS
    'Status novo.';

COMMENT ON COLUMN order_status_history.changed_by_user_id IS
    'Usuário que fez a mudança. Para auditoria.';

COMMENT ON COLUMN order_status_history.reason IS
    'Motivo da mudança (opcional). Informativo.';







