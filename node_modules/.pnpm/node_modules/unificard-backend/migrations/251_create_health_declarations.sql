-- ============================================================
-- UNIFICARD - MIGRATION 251
-- SPRINT: Autodeclaração de Saúde (domínio dedicado)
-- Tabela: health_declarations
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para armazenar autodeclarações de saúde do usuário.
-- PRINCÍPIO: Saúde é dado sensível (LGPD Art. 11) e requer consentimento explícito.
-- NÃO é categoria - é domínio próprio com trilha de auditoria.
--
-- REGRAS:
-- - Apenas autodeclaração livre (texto)
-- - Consentimento obrigatório (consent = true)
-- - Trilha de auditoria completa (created_at, updated_at)
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
    
    -- Timestamps de auditoria
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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

COMMENT ON COLUMN health_declarations.created_at IS 
    'Timestamp de criação (trilha de auditoria)';





