-- ============================================================
-- UNIFICARD - MIGRATION 228
-- SPRINT 88: CRM CANÔNICO
-- Tabela: crm_notes
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de notas do CRM para contatos.
-- Notas são append-only e podem ser INTERNAL ou SHARED.
--
-- REGRAS:
-- - Append-only (nunca deleta)
-- - Visibilidade: INTERNAL (apenas empresa) ou SHARED (compartilhado)
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- ENUM: CRM Note Visibility
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_note_visibility') THEN
    CREATE TYPE crm_note_visibility AS ENUM (
      'INTERNAL',  -- Nota interna (apenas empresa)
      'SHARED'     -- Nota compartilhada (futuro: com contact)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: crm_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_notes (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculo com contact
    contact_id UUID NOT NULL
        REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Autor
    author_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    author_user_id UUID
        REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Conteúdo
    note TEXT NOT NULL,
    visibility crm_note_visibility NOT NULL DEFAULT 'INTERNAL',
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_note_not_empty CHECK (LENGTH(TRIM(note)) > 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_crm_notes_tenant_id
    ON crm_notes(tenant_id);

-- Índice para buscar por contact
CREATE INDEX IF NOT EXISTS idx_crm_notes_contact
    ON crm_notes(tenant_id, contact_id, created_at DESC);

-- Índice para buscar por autor
CREATE INDEX IF NOT EXISTS idx_crm_notes_author
    ON crm_notes(tenant_id, author_actor_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem notas do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'crm_notes'
      AND policyname = 'crm_notes_tenant_isolation'
  ) THEN
    CREATE POLICY crm_notes_tenant_isolation
      ON crm_notes
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE crm_notes IS 'Notas do CRM para contatos (append-only). Visibilidade: INTERNAL ou SHARED.';
COMMENT ON COLUMN crm_notes.visibility IS 'Visibilidade: INTERNAL (apenas empresa) ou SHARED (compartilhado)';





