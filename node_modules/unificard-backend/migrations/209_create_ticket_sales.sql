-- ============================================================
-- UNIFICARD - MIGRATION 209
-- SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)
-- Tabela: ticket_sales
-- ============================================================
--
-- OBJETIVO:
-- Criar vendas de ingressos (reservas e confirmações).
--
-- REGRAS:
-- - Bilhete ≠ Pagamento
-- - Reserva cria PaymentIntent
-- - Pagamento SUCCESS confirma ticket
-- ============================================================

-- ============================================================
-- ENUM: Ticket Sale Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_sale_status') THEN
    CREATE TYPE ticket_sale_status AS ENUM (
      'RESERVED',  -- Reservado (aguardando pagamento)
      'PAID',      -- Pago (confirmado)
      'CANCELLED'  -- Cancelado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: ticket_sales
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_sales (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Ingresso
    event_ticket_id UUID NOT NULL
        REFERENCES event_tickets(ticket_id) ON DELETE CASCADE,
    
    -- Comprador
    buyer_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Pagamento
    payment_intent_id UUID, -- Criado na reserva
    
    -- Status
    status ticket_sale_status NOT NULL DEFAULT 'RESERVED',
    
    -- Datas
    reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    cancellation_reason TEXT,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_ticket_sales_tenant_id
    ON ticket_sales(tenant_id);

-- Índice para buscar por evento (via event_ticket)
CREATE INDEX IF NOT EXISTS idx_ticket_sales_event_ticket
    ON ticket_sales(tenant_id, event_ticket_id, status);

-- Índice para buscar por comprador
CREATE INDEX IF NOT EXISTS idx_ticket_sales_buyer
    ON ticket_sales(tenant_id, buyer_actor_id);

-- Índice para buscar por payment_intent
CREATE INDEX IF NOT EXISTS idx_ticket_sales_payment_intent
    ON ticket_sales(tenant_id, payment_intent_id)
    WHERE payment_intent_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE ticket_sales ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem vendas do próprio tenant
CREATE POLICY ticket_sales_tenant_isolation
    ON ticket_sales
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ticket_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_sales_updated_at
    BEFORE UPDATE ON ticket_sales
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_sales_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE ticket_sales IS 'Vendas de ingressos. Bilhete ≠ Pagamento.';
COMMENT ON COLUMN ticket_sales.status IS 'Status: RESERVED, PAID, CANCELLED';
COMMENT ON COLUMN ticket_sales.payment_intent_id IS 'PaymentIntent criado na reserva';






