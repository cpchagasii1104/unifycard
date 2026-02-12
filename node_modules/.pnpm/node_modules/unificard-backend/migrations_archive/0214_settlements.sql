-- ============================================================
-- UNIFICARD - MIGRATION 211
-- SPRINT 77: SETTLEMENT REGIONAL + UNIFYBANK CORE
-- Tabela: settlements
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de liquidação financeira regional.
-- Taxas de pagamento retornam para a região.
--
-- REGRAS:
-- - Settlement ≠ Payout
-- - Settlement ≠ Split
-- - Settlement ≠ Payment
-- - Tudo explícito e auditável
-- - Nada automático sem ação explícita
-- ============================================================

-- ============================================================
-- ENUM: Settlement Source Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_source_type') THEN
    CREATE TYPE settlement_source_type AS ENUM (
      'PAYMENT',  -- Pagamento de marketplace/PDV
      'TICKET',   -- Ingresso de evento
      'SERVICE'   -- Serviço
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: Settlement Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_status') THEN
    CREATE TYPE settlement_status AS ENUM (
      'PENDING',   -- Aguardando liquidação
      'SETTLED',   -- Liquidado
      'FAILED'     -- Falhou
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: settlements
-- ============================================================
CREATE TABLE IF NOT EXISTS settlements (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Região
    region_id UUID NOT NULL, -- Referência a rides_regions ou state_id
    
    -- Origem
    source_type settlement_source_type NOT NULL,
    source_id UUID NOT NULL, -- ID da origem (payment_transaction_id, ticket_sale_id, etc.)
    
    -- Valores
    gross_amount_cents BIGINT NOT NULL, -- Valor bruto
    fee_amount_cents BIGINT NOT NULL DEFAULT 0, -- Taxa (retorna para região)
    net_amount_cents BIGINT NOT NULL, -- Valor líquido (gross - fee)
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    
    -- Status
    status settlement_status NOT NULL DEFAULT 'PENDING',
    
    -- Liquidação
    settled_at TIMESTAMP WITH TIME ZONE,
    settled_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    settled_by_user_id UUID,
    
    -- Falha
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_gross_amount_positive CHECK (gross_amount_cents >= 0),
    CONSTRAINT check_fee_amount_positive CHECK (fee_amount_cents >= 0),
    CONSTRAINT check_net_amount_positive CHECK (net_amount_cents >= 0),
    CONSTRAINT check_net_equals_gross_minus_fee CHECK (net_amount_cents = gross_amount_cents - fee_amount_cents)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_settlements_tenant_id
    ON settlements(tenant_id);

-- Índice para buscar por região
CREATE INDEX IF NOT EXISTS idx_settlements_region
    ON settlements(tenant_id, region_id, status);

-- Índice para buscar por origem
CREATE INDEX IF NOT EXISTS idx_settlements_source
    ON settlements(tenant_id, source_type, source_id);

-- Índice para buscar pendentes
CREATE INDEX IF NOT EXISTS idx_settlements_pending
    ON settlements(tenant_id, status, created_at)
    WHERE status = 'PENDING';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem settlements do próprio tenant
CREATE POLICY settlements_tenant_isolation
    ON settlements
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_settlements_updated_at
    BEFORE UPDATE ON settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_settlements_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE settlements IS 'Liquidações financeiras regionais. Settlement ≠ Payout, Settlement ≠ Split, Settlement ≠ Payment.';
COMMENT ON COLUMN settlements.region_id IS 'Região que recebe a taxa (rides_regions.region_id ou state_id)';
COMMENT ON COLUMN settlements.fee_amount_cents IS 'Taxa que retorna para a região';
COMMENT ON COLUMN settlements.status IS 'Status: PENDING, SETTLED, FAILED';






