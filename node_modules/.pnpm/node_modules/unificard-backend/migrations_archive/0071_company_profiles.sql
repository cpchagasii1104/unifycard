-- ============================================================
-- UNIFICARD - MIGRATION 206
-- SPRINT 75: PERFIS ERP + REGIME TRIBUTÁRIO
-- Tabela: company_profiles
-- ============================================================
--
-- OBJETIVO:
-- Permitir que cada empresa defina:
-- - Perfil ERP (comércio, clínica, bar, eventos, serviços)
-- - Regime tributário (MEI, Lucro Presumido, Lucro Real)
--
-- REGRAS:
-- - NÃO integrar SEFAZ aqui
-- - NÃO executar cálculo tributário real
-- - Apenas modelagem + flags
-- - Perfil ≠ Configuração financeira
-- - Regime ≠ Cálculo automático
-- ============================================================

-- ============================================================
-- ENUM: ERP Profile
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'erp_profile') THEN
    CREATE TYPE erp_profile AS ENUM (
      'COMMERCE',  -- Comércio
      'SERVICE',   -- Serviços
      'EVENTS',    -- Eventos
      'FOOD',      -- Bar/Restaurante
      'CLINIC'     -- Clínica
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: Tax Regime
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_regime') THEN
    CREATE TYPE tax_regime AS ENUM (
      'MEI',              -- Microempreendedor Individual
      'LUCRO_PRESUMIDO',  -- Lucro Presumido
      'LUCRO_REAL'        -- Lucro Real
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: company_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS company_profiles (
    -- Identificação (1 por tenant)
    tenant_id UUID PRIMARY KEY
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Perfil e regime
    erp_profile erp_profile NOT NULL,
    tax_regime tax_regime NOT NULL,
    
    -- Criação/Atualização
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    updated_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    updated_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_company_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_profiles_updated_at
    BEFORE UPDATE ON company_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_company_profiles_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem perfil do próprio tenant
CREATE POLICY company_profiles_tenant_isolation
    ON company_profiles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE company_profiles IS 'Perfis ERP e regime tributário por empresa. Apenas modelagem, não executa cálculos.';
COMMENT ON COLUMN company_profiles.erp_profile IS 'Perfil: COMMERCE, SERVICE, EVENTS, FOOD, CLINIC';
COMMENT ON COLUMN company_profiles.tax_regime IS 'Regime: MEI, LUCRO_PRESUMIDO, LUCRO_REAL';






