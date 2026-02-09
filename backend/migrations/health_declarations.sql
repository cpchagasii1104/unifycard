-- ============================================================
-- UNIFICARD - MIGRATION: health_declarations (CONSOLIDADO)
-- SPRINT: Autodeclaração de Saúde (domínio dedicado) + Raio-X Estruturado
-- Tabela: health_declarations
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para armazenar autodeclarações de saúde do usuário.
-- PRINCÍPIO: Saúde é dado sensível (LGPD Art. 11) e requer consentimento explícito.
-- NÃO é categoria - é domínio próprio com trilha de auditoria.
--
-- REGRAS:
-- - Suporta autodeclaração livre (texto) e estruturada (JSONB)
-- - Consentimento obrigatório (consent = true)
-- - Trilha de auditoria completa (created_at, updated_at)
-- - Suporta seções (visão, odontologia, medicamentos, mobilidade, etc.)
-- - NÃO gera diagnóstico ou inferência médica
-- - NÃO bloqueia acesso a funcionalidades
-- ============================================================

-- ============================================================
-- TABELA: health_declarations
-- ============================================================
CREATE TABLE IF NOT EXISTS health_declarations (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que está declarando (activeActor)
    actor_id UUID NOT NULL,
    
    -- Conteúdo da autodeclaração
    declaration_text TEXT NOT NULL,
    
    -- Observações opcionais
    notes TEXT,
    
    -- Consentimento explícito (OBRIGATÓRIO - deve ser true)
    consent BOOLEAN NOT NULL DEFAULT false
        CHECK (consent = true),
    
    -- Dados estruturados da autodeclaração (JSONB)
    payload JSONB NULL,
    
    -- Seção da autodeclaração: general, vision, dental, medications, mobility, mental, other
    section TEXT NULL,
    
    -- Escopo do consentimento (granular por seção)
    consent_scope TEXT NULL,
    
    -- Timestamps de auditoria
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint para validar valores de section
    CONSTRAINT health_declarations_section_check
        CHECK (
            section IS NULL 
            OR section IN ('general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other')
        )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_health_declarations_tenant_id 
    ON health_declarations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_health_declarations_actor_id 
    ON health_declarations(actor_id);

CREATE INDEX IF NOT EXISTS idx_health_declarations_created_at 
    ON health_declarations(created_at DESC);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_health_declarations_tenant_actor 
    ON health_declarations(tenant_id, actor_id, created_at DESC);

-- Índice para consultas por seção
CREATE INDEX IF NOT EXISTS idx_health_declarations_section
    ON health_declarations(tenant_id, actor_id, section, created_at DESC);

-- Índice para consultas por consent_scope
CREATE INDEX IF NOT EXISTS idx_health_declarations_consent_scope
    ON health_declarations(tenant_id, actor_id, consent_scope)
    WHERE consent_scope IS NOT NULL;

-- Índice GIN para queries JSONB no payload
CREATE INDEX IF NOT EXISTS idx_health_declarations_payload_gin
    ON health_declarations USING GIN (payload)
    WHERE payload IS NOT NULL;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE health_declarations IS 
    'Autodeclarações de saúde do usuário - dado sensível com consentimento obrigatório';

COMMENT ON COLUMN health_declarations.actor_id IS 
    'ID do actor que está declarando (activeActor)';

COMMENT ON COLUMN health_declarations.declaration_text IS 
    'Texto livre da autodeclaração de saúde';

COMMENT ON COLUMN health_declarations.consent IS 
    'Consentimento explícito obrigatório (deve ser true)';

COMMENT ON COLUMN health_declarations.payload IS 
    'Dados estruturados da autodeclaração (JSONB) - ex: {glasses: true, lastExam: "2024-01-01"}';

COMMENT ON COLUMN health_declarations.section IS 
    'Seção da autodeclaração: general, vision, dental, medications, mobility, mental, other';

COMMENT ON COLUMN health_declarations.consent_scope IS 
    'Escopo do consentimento (granular por seção) - ex: "vision", "dental"';

COMMENT ON COLUMN health_declarations.created_at IS 
    'Timestamp de criação (trilha de auditoria)';

