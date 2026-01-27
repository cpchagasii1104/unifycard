-- ============================================================
-- UNIFICARD - MIGRATION 230
-- SPRINT 88: CRM CANÔNICO
-- Tabela: crm_contact_tags
-- ============================================================
--
-- OBJETIVO:
-- Vincular tags a contatos (many-to-many).
--
-- REGRAS:
-- - 1 contato pode ter múltiplas tags
-- - 1 tag pode estar em múltiplos contatos
-- - Idempotência por (tenant_id, contact_id, tag_id)
-- ============================================================

-- ============================================================
-- TABELA: crm_contact_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_contact_tags (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculos
    contact_id UUID NOT NULL
        REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL
        REFERENCES crm_tags(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT crm_contact_tags_unique_per_contact_tag UNIQUE (tenant_id, contact_id, tag_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_crm_contact_tags_tenant_id
    ON crm_contact_tags(tenant_id);

-- Índice para buscar por contact
CREATE INDEX IF NOT EXISTS idx_crm_contact_tags_contact
    ON crm_contact_tags(tenant_id, contact_id);

-- Índice para buscar por tag
CREATE INDEX IF NOT EXISTS idx_crm_contact_tags_tag
    ON crm_contact_tags(tenant_id, tag_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE crm_contact_tags ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem vínculos do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'crm_contact_tags'
      AND policyname = 'crm_contact_tags_tenant_isolation'
  ) THEN
    CREATE POLICY crm_contact_tags_tenant_isolation
      ON crm_contact_tags
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE crm_contact_tags IS 'Vínculo many-to-many entre contatos e tags. Idempotência por (tenant_id, contact_id, tag_id).';





