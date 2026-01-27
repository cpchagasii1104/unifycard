-- ============================================================
-- UNIFICARD - MIGRATION 210
-- SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)
-- Tabela: event_checkins
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de check-in e check-out para eventos.
--
-- REGRAS:
-- - Check-in ≠ Pagamento
-- - Check-in só permitido dentro do horário do evento
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- TABELA: event_checkins
-- ============================================================
CREATE TABLE IF NOT EXISTS event_checkins (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Venda de ingresso
    ticket_sale_id UUID NOT NULL
        REFERENCES ticket_sales(id) ON DELETE CASCADE,
    
    -- Check-in
    checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    checked_in_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    checked_in_by_user_id UUID,
    
    -- Check-out (opcional)
    checked_out_at TIMESTAMP WITH TIME ZONE,
    checked_out_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    checked_out_by_user_id UUID,
    
    -- Criação
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_out_after_check_in CHECK (
        checked_out_at IS NULL OR checked_out_at >= checked_in_at
    )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_event_checkins_tenant_id
    ON event_checkins(tenant_id);

-- Índice para buscar por ticket_sale
CREATE INDEX IF NOT EXISTS idx_event_checkins_ticket_sale
    ON event_checkins(tenant_id, ticket_sale_id);

-- Índice para buscar por data de check-in
CREATE INDEX IF NOT EXISTS idx_event_checkins_checked_in
    ON event_checkins(tenant_id, checked_in_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem check-ins do próprio tenant
CREATE POLICY event_checkins_tenant_isolation
    ON event_checkins
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_event_checkins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_checkins_updated_at
    BEFORE UPDATE ON event_checkins
    FOR EACH ROW
    EXECUTE FUNCTION update_event_checkins_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE event_checkins IS 'Check-ins e check-outs de eventos. Check-in ≠ Pagamento.';
COMMENT ON COLUMN event_checkins.ticket_sale_id IS 'Venda de ingresso (deve estar PAID)';






