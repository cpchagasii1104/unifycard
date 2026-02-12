-- ============================================================
-- UNIFICARD - MIGRATION: health_declarations (CONSOLIDADO)
-- Domínio: Autodeclaração de Saúde
-- Banco: PostgreSQL 14+
--
-- PRINCÍPIO:
-- - Dado sensível (LGPD Art. 11)
-- - Consentimento explícito obrigatório
-- - Domínio próprio, sem inferência médica
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA: health_declarations
-- ============================================================

CREATE TABLE IF NOT EXISTS health_declarations (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id) ON DELETE CASCADE,

    -- Actor que está declarando (activeActor)
    actor_id UUID NOT NULL
        REFERENCES actors(id) ON DELETE CASCADE,

    -- Conteúdo da autodeclaração
    declaration_text TEXT NOT NULL,

    -- Observações opcionais
    notes TEXT,

    -- Consentimento explícito (OBRIGATÓRIO)
    consent BOOLEAN NOT NULL
        CHECK (consent = true),

    -- Dados estruturados (JSONB)
    payload JSONB,

    -- Seção da autodeclaração
    section TEXT
        CHECK (
            section IS NULL OR
            section IN (
                'general',
                'vision',
                'dental',
                'medications',
                'mobility',
                'mental',
                'other'
            )
        ),

    -- Escopo granular do consentimento
    consent_scope TEXT,

    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (OBRIGATÓRIO)
-- ============================================================

ALTER TABLE health_declarations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'health_declarations'
      AND policyname = 'health_declarations_rls'
  ) THEN
    CREATE POLICY health_declarations_rls
      ON health_declarations
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_health_declarations_tenant
    ON health_declarations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_health_declarations_actor
    ON health_declarations (actor_id);

CREATE INDEX IF NOT EXISTS idx_health_declarations_created_at
    ON health_declarations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_declarations_tenant_actor
    ON health_declarations (tenant_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_declarations_section
    ON health_declarations (tenant_id, actor_id, section, created_at DESC)
    WHERE section IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_declarations_consent_scope
    ON health_declarations (tenant_id, actor_id, consent_scope)
    WHERE consent_scope IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_declarations_payload_gin
    ON health_declarations
    USING GIN (payload)
    WHERE payload IS NOT NULL;

-- ============================================================
-- COMENTÁRIOS (DOCUMENTAÇÃO LEGAL)
-- ============================================================

COMMENT ON TABLE health_declarations IS
    'Autodeclarações de saúde do actor — dado sensível (LGPD Art. 11), com consentimento obrigatório';

COMMENT ON COLUMN health_declarations.actor_id IS
    'Actor que realiza a autodeclaração (identidade canônica)';

COMMENT ON COLUMN health_declarations.declaration_text IS
    'Texto livre da autodeclaração de saúde';

COMMENT ON COLUMN health_declarations.consent IS
    'Consentimento explícito obrigatório (sempre true)';

COMMENT ON COLUMN health_declarations.payload IS
    'Dados estruturados da autodeclaração (JSONB), sem inferência médica';

COMMENT ON COLUMN health_declarations.section IS
    'Seção temática da autodeclaração';

COMMENT ON COLUMN health_declarations.consent_scope IS
    'Escopo granular do consentimento';

COMMENT ON COLUMN health_declarations.created_at IS
    'Timestamp de criação — trilha de auditoria';

COMMIT;
