-- ============================================================
-- UNIFICARD - MIGRATION 152
-- CONTINUOUS PRODUCTION: Policy Registry
-- Tabela: bank_policies
-- ============================================================
--
-- OBJETIVO:
-- Criar Policy Registry versionado para separar política de execução.
-- Permite configurar percentuais de split sem hardcode.
--
-- REGRAS:
-- - Última versão ativa (status='active') é usada
-- - Versões antigas mantidas para auditoria
-- - Backward compatible: se não houver policy, usa defaults
-- ============================================================

-- ============================================================
-- TABELA: bank_policies
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_policies (
    -- Identificação
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Chave da política (ex: 'split.service_booking', 'split.ride_payment')
    key VARCHAR(100) NOT NULL,
    
    -- Versão (incrementa a cada mudança)
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Status: 'active', 'deprecated', 'draft'
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'deprecated', 'draft')),
    
    -- Valor da política (JSON)
    value_json JSONB NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: única versão ativa por tenant+key
    CONSTRAINT unique_active_policy UNIQUE (tenant_id, key, version)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por tenant e key (última versão ativa)
CREATE INDEX IF NOT EXISTS idx_bank_policies_tenant_key_status
    ON bank_policies (tenant_id, key, status, version DESC);

-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_bank_policies_tenant
    ON bank_policies (tenant_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bank_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_policies_rls ON bank_policies
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_bank_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bank_policies_updated_at
    BEFORE UPDATE ON bank_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_policies_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_policies IS
    'Policy Registry versionado para configuração de splits e regras de negócio';

COMMENT ON COLUMN bank_policies.key IS
    'Chave da política (ex: split.service_booking, split.ride_payment)';

COMMENT ON COLUMN bank_policies.version IS
    'Versão da política (incrementa a cada mudança)';

COMMENT ON COLUMN bank_policies.status IS
    'Status: active (usada), deprecated (obsoleta), draft (rascunho)';

COMMENT ON COLUMN bank_policies.value_json IS
    'Valor da política em JSON (estrutura depende da key)';

-- ============================================================
-- SEED: Policies padrão para contexts existentes
-- ============================================================
INSERT INTO bank_policies (tenant_id, key, version, status, value_json)
SELECT 
    tenant_id,
    'split.service_booking',
    1,
    'active',
    '{"splits": [{"splitType": "revenue_share", "percentage": 0.97}, {"splitType": "fee", "percentage": 0.03, "targetAccountName": "fee"}]}'::jsonb
FROM tenants
ON CONFLICT (tenant_id, key, version) DO NOTHING;

INSERT INTO bank_policies (tenant_id, key, version, status, value_json)
SELECT 
    tenant_id,
    'split.ride_payment',
    1,
    'active',
    '{"splits": [{"splitType": "revenue_share", "percentage": 0.97}, {"splitType": "fee", "percentage": 0.03, "targetAccountName": "fee"}]}'::jsonb
FROM tenants
ON CONFLICT (tenant_id, key, version) DO NOTHING;

INSERT INTO bank_policies (tenant_id, key, version, status, value_json)
SELECT 
    tenant_id,
    'split.p2p_transfer',
    1,
    'active',
    '{"splits": [{"splitType": "revenue_share", "percentage": 1.0}]}'::jsonb
FROM tenants
ON CONFLICT (tenant_id, key, version) DO NOTHING;

INSERT INTO bank_policies (tenant_id, key, version, status, value_json)
SELECT 
    tenant_id,
    'split.group_contribution',
    1,
    'active',
    '{"splits": [{"splitType": "revenue_share", "percentage": 1.0}]}'::jsonb
FROM tenants
ON CONFLICT (tenant_id, key, version) DO NOTHING;

INSERT INTO bank_policies (tenant_id, key, version, status, value_json)
SELECT 
    tenant_id,
    'split.event_ticket',
    1,
    'active',
    '{"splits": [{"splitType": "revenue_share", "percentage": 0.70}, {"splitType": "fee", "percentage": 0.03, "targetAccountName": "fee"}, {"splitType": "regional_fund", "percentage": 0.10, "targetAccountName": "regional_fund"}, {"splitType": "reserve", "percentage": 0.17, "targetAccountName": "reserve"}]}'::jsonb
FROM tenants
ON CONFLICT (tenant_id, key, version) DO NOTHING;







