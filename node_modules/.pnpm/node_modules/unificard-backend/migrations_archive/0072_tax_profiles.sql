-- ============================================================
-- UNIFICARD - MIGRATION 217
-- SPRINT 80: FISCAL REAL POR REGIME TRIBUTÁRIO (READ + ADAPTER)
-- Tabela: tax_profiles
-- ============================================================
--
-- OBJETIVO:
-- Preparar o sistema para operar corretamente com diferentes
-- regimes tributários brasileiros (MEI, Simples, Presumido, Real),
-- SEM calcular imposto automaticamente e SEM integrar SEFAZ real ainda.
--
-- REGRAS:
-- - Regime tributário ≠ cálculo automático
-- - Regime tributário ≠ pagamento
-- - Regime tributário influencia:
--   - Tipo de documento fiscal permitido
--   - Campos obrigatórios
--   - Validações futuras
-- - Nenhum imposto é calculado
-- - Nenhuma alíquota aplicada
-- ============================================================

-- ============================================================
-- ENUM: Tax Regime (reutiliza do company_profiles se existir)
-- ============================================================
-- Nota: tax_regime já existe em company_profiles, mas vamos
-- garantir que está disponível para tax_profiles também
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_regime') THEN
    CREATE TYPE tax_regime AS ENUM (
      'MEI',              -- Microempreendedor Individual
      'SIMPLES',          -- Simples Nacional
      'PRESUMIDO',        -- Lucro Presumido
      'REAL'              -- Lucro Real
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: tax_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_profiles (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculo com company_profile (via tenant_id)
    -- Nota: company_profiles usa tenant_id como PK
    -- Então usamos tenant_id como FK para company_profiles
    -- Constraint UNIQUE garante 1 tax_profile por tenant
    company_profile_tenant_id UUID NOT NULL
        REFERENCES company_profiles(tenant_id) ON DELETE CASCADE,
    
    -- Regime tributário
    tax_regime tax_regime NOT NULL,
    
    -- Localização (importante para ICMS)
    state VARCHAR(2), -- UF (ex: SP, RJ)
    city VARCHAR(255),
    
    -- Flags tributárias
    is_icms_contributor BOOLEAN NOT NULL DEFAULT false,
    is_service_provider BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT tax_profiles_unique_per_tenant UNIQUE (tenant_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_tax_profiles_tenant_id
    ON tax_profiles(tenant_id);

-- Índice para buscar por company_profile
CREATE INDEX IF NOT EXISTS idx_tax_profiles_company_profile
    ON tax_profiles(company_profile_tenant_id);

-- Índice para buscar por regime
CREATE INDEX IF NOT EXISTS idx_tax_profiles_regime
    ON tax_profiles(tenant_id, tax_regime);

-- Índice para buscar por estado
CREATE INDEX IF NOT EXISTS idx_tax_profiles_state
    ON tax_profiles(tenant_id, state)
    WHERE state IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem tax_profiles do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'tax_profiles'
      AND policyname = 'tax_profiles_tenant_isolation'
  ) THEN
    CREATE POLICY tax_profiles_tenant_isolation
      ON tax_profiles
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_tax_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tax_profiles_updated_at
    BEFORE UPDATE ON tax_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_tax_profiles_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE tax_profiles IS 'Perfis fiscais detalhados por regime tributário. Não calcula impostos, apenas valida estruturalmente.';
COMMENT ON COLUMN tax_profiles.tax_regime IS 'Regime: MEI, SIMPLES, PRESUMIDO, REAL';
COMMENT ON COLUMN tax_profiles.is_icms_contributor IS 'Contribuinte de ICMS (importante para validações)';
COMMENT ON COLUMN tax_profiles.is_service_provider IS 'Prestador de serviços (importante para NFS-e)';






