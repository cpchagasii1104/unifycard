-- ============================================================
-- UNIFICARD - MIGRATION 205
-- SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES
-- Tabela: commission_rules
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de regras de comissão declarativas.
-- Calcula comissões, mas NÃO executa pagamentos.
--
-- REGRAS:
-- - Nenhuma execução de pagamentos
-- - Nenhum split automático
-- - Nenhum payout
-- - Apenas cálculo, snapshot e rastreabilidade
-- - Comissão ≠ Split
-- - Comissão ≠ Payout
-- - Comissão ≠ Ledger
-- ============================================================

-- ============================================================
-- ENUM: Applies To
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_applies_to') THEN
    CREATE TYPE commission_applies_to AS ENUM (
      'GROUP',         -- Aplica a um grupo
      'REFERRAL',      -- Aplica a um código de indicação
      'PAYMENT_METHOD' -- Aplica a um método de pagamento
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: commission_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_rules (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Aplicação
    applies_to commission_applies_to NOT NULL,
    applies_id UUID NOT NULL, -- group_id, referral_code_id, payment_method_id
    
    -- Percentuais (declarativos, não executados)
    base_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0, -- Ex: 0.05 = 5%
    regional_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0,
    platform_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_percentages_range CHECK (
        base_percentage >= 0 AND base_percentage <= 1 AND
        regional_percentage >= 0 AND regional_percentage <= 1 AND
        platform_percentage >= 0 AND platform_percentage <= 1
    )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant_id
    ON commission_rules(tenant_id);

-- Índice para buscar por aplicação
CREATE INDEX IF NOT EXISTS idx_commission_rules_applies
    ON commission_rules(tenant_id, applies_to, applies_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem regras do próprio tenant
CREATE POLICY commission_rules_tenant_isolation
    ON commission_rules
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE commission_rules IS 'Regras de comissão declarativas. Calcula, mas não executa pagamentos.';
COMMENT ON COLUMN commission_rules.applies_to IS 'Tipo de aplicação: GROUP, REFERRAL, PAYMENT_METHOD';
COMMENT ON COLUMN commission_rules.applies_id IS 'ID da entidade (group_id, referral_code_id, payment_method_id)';
COMMENT ON COLUMN commission_rules.base_percentage IS 'Percentual base (declarativo, não executado)';
COMMENT ON COLUMN commission_rules.regional_percentage IS 'Percentual regional (declarativo, não executado)';
COMMENT ON COLUMN commission_rules.platform_percentage IS 'Percentual da plataforma (declarativo, não executado)';






