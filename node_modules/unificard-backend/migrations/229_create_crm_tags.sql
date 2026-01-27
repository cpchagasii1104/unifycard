-- ============================================================
-- UNIFICARD - MIGRATION 229
-- SPRINT 88: CRM CANÔNICO
-- Tabela: crm_tags
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de tags do CRM para segmentação de contatos.
--
-- REGRAS:
-- - Tags são globais por tenant
-- - Nome único por tenant
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- TABELA: crm_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_tags (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Dados
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7), -- Hex color (ex: #FF5733)
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT crm_tags_unique_name_per_tenant UNIQUE (tenant_id, name)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_crm_tags_tenant_id
    ON crm_tags(tenant_id);

-- Índice para buscar por nome
CREATE INDEX IF NOT EXISTS idx_crm_tags_name
    ON crm_tags(tenant_id, name);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem tags do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'crm_tags'
      AND policyname = 'crm_tags_tenant_isolation'
  ) THEN
    CREATE POLICY crm_tags_tenant_isolation
      ON crm_tags
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE crm_tags IS 'Tags do CRM para segmentação de contatos. Nome único por tenant.';





