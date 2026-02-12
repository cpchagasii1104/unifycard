-- ============================================================
-- UNIFICARD - MIGRATION 218
-- SPRINT 81: ERP POR SEGMENTO (PERFIS OPERACIONAIS)
-- Tabela: business_segments
-- ============================================================
--
-- OBJETIVO:
-- Permitir que o sistema se adapte ao tipo de negócio
-- (COMÉRCIO, CLÍNICA, SALÃO, BAR/RESTAURANTE, SERVIÇOS),
-- sem duplicar lógica e sem criar módulos paralelos.
--
-- REGRAS:
-- - Segmento ≠ permissão
-- - Segmento ≠ papel
-- - Segmento define:
--   - Módulos visíveis
--   - Fluxos esperados
-- - Nenhuma lógica automática
-- - Apenas configuração estrutural
-- ============================================================

-- ============================================================
-- ENUM: Business Segment Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_segment_type') THEN
    CREATE TYPE business_segment_type AS ENUM (
      'COMMERCE',        -- Comércio
      'CLINIC',          -- Clínica
      'SALON',           -- Salão
      'BAR_RESTAURANT',  -- Bar/Restaurante
      'SERVICES'         -- Serviços
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: business_segments
-- ============================================================
CREATE TABLE IF NOT EXISTS business_segments (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculo com company_profile (via tenant_id)
    -- Nota: company_profiles usa tenant_id como PK
    company_profile_tenant_id UUID NOT NULL
        REFERENCES company_profiles(tenant_id) ON DELETE CASCADE,
    
    -- Segmento
    segment_type business_segment_type NOT NULL,
    
    -- Módulos habilitados (JSONB array de strings)
    -- Ex: ["pdv", "inventory", "service_orders", "events", "tickets"]
    enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT business_segments_unique_per_tenant UNIQUE (tenant_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_business_segments_tenant_id
    ON business_segments(tenant_id);

-- Índice para buscar por company_profile
CREATE INDEX IF NOT EXISTS idx_business_segments_company_profile
    ON business_segments(company_profile_tenant_id);

-- Índice para buscar por segment_type
CREATE INDEX IF NOT EXISTS idx_business_segments_type
    ON business_segments(tenant_id, segment_type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE business_segments ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem segments do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'business_segments'
      AND policyname = 'business_segments_tenant_isolation'
  ) THEN
    CREATE POLICY business_segments_tenant_isolation
      ON business_segments
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_business_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_business_segments_updated_at
    BEFORE UPDATE ON business_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_business_segments_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE business_segments IS 'Segmentos de negócio para adaptação do ERP. Segmento ≠ permissão. Segmento ≠ papel. Apenas configuração estrutural.';
COMMENT ON COLUMN business_segments.segment_type IS 'Tipo: COMMERCE, CLINIC, SALON, BAR_RESTAURANT, SERVICES';
COMMENT ON COLUMN business_segments.enabled_modules IS 'Array JSONB de módulos habilitados (ex: ["pdv", "inventory", "service_orders"])';






