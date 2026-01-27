-- ============================================================
-- UNIFICARD - MIGRATION 221
-- SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA
-- Tabela: event_settlements
-- ============================================================
--
-- OBJETIVO:
-- Fechar o ciclo econômico de eventos:
-- - Bilheteria
-- - Comissão
-- - Taxa regional
-- - Settlement por evento
--
-- REGRAS:
-- - Evento ≠ Empresa
-- - Evento ≠ Payout
-- - Tudo explícito
-- - Nada automático
-- ============================================================

-- ============================================================
-- ENUM: Event Settlement Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_settlement_status') THEN
    CREATE TYPE event_settlement_status AS ENUM (
      'PENDING',   -- Aguardando liquidação
      'SETTLED'    -- Liquidado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: event_settlements
-- ============================================================
CREATE TABLE IF NOT EXISTS event_settlements (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Evento
    event_id UUID NOT NULL
        REFERENCES events(id) ON DELETE CASCADE,
    
    -- Valores
    gross_revenue BIGINT NOT NULL, -- Receita bruta em centavos
    commissions_amount BIGINT NOT NULL DEFAULT 0, -- Total de comissões em centavos
    regional_fee_amount BIGINT NOT NULL DEFAULT 0, -- Total de taxas regionais em centavos
    net_amount BIGINT NOT NULL, -- Valor líquido (gross - commissions - regional_fee)
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    
    -- Status
    status event_settlement_status NOT NULL DEFAULT 'PENDING',
    
    -- Settlement vinculado (quando liquidado)
    settlement_id UUID
        REFERENCES settlements(id) ON DELETE SET NULL,
    
    -- Liquidação
    settled_at TIMESTAMP WITH TIME ZONE,
    settled_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    settled_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_gross_revenue_positive CHECK (gross_revenue >= 0),
    CONSTRAINT check_commissions_positive CHECK (commissions_amount >= 0),
    CONSTRAINT check_regional_fee_positive CHECK (regional_fee_amount >= 0),
    CONSTRAINT check_net_amount_positive CHECK (net_amount >= 0),
    CONSTRAINT check_net_equals_gross_minus_fees CHECK (
        net_amount = gross_revenue - commissions_amount - regional_fee_amount
    )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_event_settlements_tenant_id
    ON event_settlements(tenant_id);

-- Índice para buscar por evento
CREATE INDEX IF NOT EXISTS idx_event_settlements_event
    ON event_settlements(tenant_id, event_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_event_settlements_status
    ON event_settlements(tenant_id, status, created_at)
    WHERE status = 'PENDING';

-- Índice para buscar por settlement
CREATE INDEX IF NOT EXISTS idx_event_settlements_settlement
    ON event_settlements(tenant_id, settlement_id)
    WHERE settlement_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE event_settlements ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem settlements do próprio tenant
CREATE POLICY event_settlements_tenant_isolation
    ON event_settlements
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_event_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_settlements_updated_at
    BEFORE UPDATE ON event_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_event_settlements_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE event_settlements IS 'Settlements de eventos. Evento ≠ Empresa, Evento ≠ Payout. Tudo explícito.';
COMMENT ON COLUMN event_settlements.gross_revenue IS 'Receita bruta do evento (soma de todos os ingressos vendidos)';
COMMENT ON COLUMN event_settlements.commissions_amount IS 'Total de comissões (artista, casa, plataforma)';
COMMENT ON COLUMN event_settlements.regional_fee_amount IS 'Total de taxas regionais';
COMMENT ON COLUMN event_settlements.settlement_id IS 'Settlement vinculado quando liquidado';





