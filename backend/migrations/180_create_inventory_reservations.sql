-- ============================================================
-- UNIFICARD - MIGRATION 180
-- SPRINT 43: ESTOQUE COM RESERVA (SOFT HOLD)
-- Tabela: inventory_reservations
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para reservas de estoque (soft hold).
-- Evita dupla venda quando produto é vendido online e ainda está na loja.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Reserva é lógica, não física
-- - Append-only (não altera histórico)
-- - Não altera inventory_movements
-- - Não cria estoque mutável
-- ============================================================

-- ============================================================
-- ENUM: Status da reserva
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_reservation_status') THEN
        CREATE TYPE inventory_reservation_status AS ENUM (
            'ACTIVE',    -- Reserva ativa (bloqueia estoque)
            'RELEASED',  -- Reserva liberada (pedido cancelado/expirado)
            'CONSUMED'   -- Reserva consumida (pagamento sucesso, estoque baixado)
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Origem da reserva
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_reservation_source') THEN
        CREATE TYPE inventory_reservation_source AS ENUM (
            'MARKETPLACE',  -- Reserva do marketplace online
            'PDV'           -- Reserva do PDV físico
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: inventory_reservations
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_reservations (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Variante do produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Quantidade reservada
    quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
    
    -- Pedido que gerou a reserva
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,
    
    -- Origem da reserva
    source inventory_reservation_source NOT NULL,
    
    -- Status da reserva
    status inventory_reservation_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Expiração (opcional, para reservas temporárias)
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_tenant
    ON inventory_reservations (tenant_id);

-- Índice para buscar por variante
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant
    ON inventory_reservations (tenant_id, product_variant_id);

-- Índice para buscar por pedido
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order
    ON inventory_reservations (tenant_id, order_id);

-- Índice para buscar reservas ativas por variante
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_active
    ON inventory_reservations (tenant_id, product_variant_id, status)
    WHERE status = 'ACTIVE';

-- Índice para buscar reservas expiradas
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires
    ON inventory_reservations (tenant_id, status, expires_at)
    WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_reservations_rls ON inventory_reservations
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER inventory_reservations_updated_at
    BEFORE UPDATE ON inventory_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Prevenir UPDATE/DELETE (append-only)
-- ============================================================
-- Permitir apenas UPDATE de status (para RELEASED/CONSUMED)
-- Bloquear DELETE
CREATE OR REPLACE FUNCTION prevent_inventory_reservation_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'inventory_reservations é append-only. DELETE não permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_reservations_prevent_delete
    BEFORE DELETE ON inventory_reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inventory_reservation_delete();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE inventory_reservations IS
    'Reservas de estoque (soft hold). Evita dupla venda. Append-only.';

COMMENT ON COLUMN inventory_reservations.quantity IS
    'Quantidade reservada. Deve ser > 0.';

COMMENT ON COLUMN inventory_reservations.order_id IS
    'Pedido que gerou a reserva. Uma reserva pertence a um pedido.';

COMMENT ON COLUMN inventory_reservations.source IS
    'Origem da reserva: MARKETPLACE (online) ou PDV (físico).';

COMMENT ON COLUMN inventory_reservations.status IS
    'Status: ACTIVE (bloqueia estoque), RELEASED (liberada), CONSUMED (consumida).';

COMMENT ON COLUMN inventory_reservations.expires_at IS
    'Data de expiração (opcional). Reservas expiradas devem ser liberadas.';







