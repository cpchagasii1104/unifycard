-- ============================================================
-- UNIFICARD - MIGRATION 220
-- SPRINT 83: TAXA REGIONAL + ECONOMIA COMUNITÁRIA
-- Tabela: regional_fees
-- ============================================================
--
-- OBJETIVO:
-- Formalizar o fluxo econômico regional:
-- - Taxas de pagamento
-- - Retorno para região
-- - Transparência total
--
-- REGRAS:
-- - Fee ≠ Split
-- - Fee ≠ Payout
-- - Fee ≠ Tax
-- - Nenhuma execução automática externa
-- - Apenas modelagem e registro
-- ============================================================

-- ============================================================
-- ENUM: Regional Fee Source Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'regional_fee_source_type') THEN
    CREATE TYPE regional_fee_source_type AS ENUM (
      'PAYMENT',      -- Pagamento de marketplace/PDV
      'EVENT',        -- Ingresso de evento
      'SUBSCRIPTION'  -- Assinatura
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: regional_fees
-- ============================================================
CREATE TABLE IF NOT EXISTS regional_fees (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Região
    region_id UUID NOT NULL, -- Referência a rides_regions ou state_id
    
    -- Origem
    source_type regional_fee_source_type NOT NULL,
    source_id UUID NOT NULL, -- ID da origem (payment_transaction_id, ticket_sale_id, etc.)
    
    -- Valores
    gross_amount BIGINT NOT NULL, -- Valor bruto em centavos
    fee_percentage NUMERIC(5, 2) NOT NULL, -- Percentual da taxa (ex: 3.50)
    fee_amount BIGINT NOT NULL, -- Valor da taxa em centavos
    
    -- Settlement vinculado (quando liquidado)
    settlement_id UUID
        REFERENCES settlements(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_gross_amount_positive CHECK (gross_amount >= 0),
    CONSTRAINT check_fee_percentage_positive CHECK (fee_percentage >= 0),
    CONSTRAINT check_fee_amount_positive CHECK (fee_amount >= 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_regional_fees_tenant_id
    ON regional_fees(tenant_id);

-- Índice para buscar por região
CREATE INDEX IF NOT EXISTS idx_regional_fees_region
    ON regional_fees(tenant_id, region_id);

-- Índice para buscar por origem
CREATE INDEX IF NOT EXISTS idx_regional_fees_source
    ON regional_fees(tenant_id, source_type, source_id);

-- Índice para buscar por settlement
CREATE INDEX IF NOT EXISTS idx_regional_fees_settlement
    ON regional_fees(tenant_id, settlement_id)
    WHERE settlement_id IS NOT NULL;

-- Índice para buscar por data
CREATE INDEX IF NOT EXISTS idx_regional_fees_created_at
    ON regional_fees(tenant_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE regional_fees ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem fees do próprio tenant
CREATE POLICY regional_fees_tenant_isolation
    ON regional_fees
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE regional_fees IS 'Taxas regionais. Fee ≠ Split, Fee ≠ Payout, Fee ≠ Tax. Apenas modelagem e registro.';
COMMENT ON COLUMN regional_fees.region_id IS 'Região que recebe a taxa (rides_regions.region_id ou state_id)';
COMMENT ON COLUMN regional_fees.settlement_id IS 'Settlement vinculado quando taxa é liquidada';
COMMENT ON COLUMN regional_fees.fee_amount IS 'Valor da taxa em centavos (snapshot no momento da criação)';





