-- ============================================================
-- UNIFICARD - MIGRATION 252
-- SPRINT: Saúde V2 - Raio-X Estruturado
-- Tabela: health_declarations (EXTENSÃO)
-- ============================================================
--
-- OBJETIVO:
-- Estender health_declarations para suportar raio-x estruturado
-- com seções (visão, odontologia, medicamentos, mobilidade, etc.)
-- SEM duplicar taxonomia nem criar sistema paralelo.
--
-- REGRAS:
-- - Mantém compatibilidade com declaration_text (texto livre)
-- - Adiciona payload JSONB para dados estruturados
-- - Adiciona section para organizar por domínio
-- - Adiciona consent_scope para consentimento granular
-- - NÃO gera diagnóstico ou inferência médica
-- - NÃO bloqueia acesso a funcionalidades
-- ============================================================

-- ============================================================
-- EXTENSÃO: health_declarations
-- ============================================================

-- Adicionar coluna payload (JSONB) para dados estruturados
ALTER TABLE health_declarations
ADD COLUMN IF NOT EXISTS payload JSONB NULL;

-- Adicionar coluna section (TEXT) para organizar por domínio
-- Valores permitidos: 'general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other'
ALTER TABLE health_declarations
ADD COLUMN IF NOT EXISTS section TEXT NULL;

-- Adicionar coluna consent_scope (TEXT) para consentimento granular por seção
ALTER TABLE health_declarations
ADD COLUMN IF NOT EXISTS consent_scope TEXT NULL;

-- ============================================================
-- ÍNDICES
-- ============================================================

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

COMMENT ON COLUMN health_declarations.payload IS 
    'Dados estruturados da autodeclaração (JSONB) - ex: {glasses: true, lastExam: "2024-01-01"}';

COMMENT ON COLUMN health_declarations.section IS 
    'Seção da autodeclaração: general, vision, dental, medications, mobility, mental, other';

COMMENT ON COLUMN health_declarations.consent_scope IS 
    'Escopo do consentimento (granular por seção) - ex: "vision", "dental"';

-- ============================================================
-- VALIDAÇÃO: Constraint para section válida (opcional, mas recomendado)
-- ============================================================

-- Constraint para validar valores de section
ALTER TABLE health_declarations
DROP CONSTRAINT IF EXISTS health_declarations_section_check;

ALTER TABLE health_declarations
ADD CONSTRAINT health_declarations_section_check
    CHECK (
        section IS NULL 
        OR section IN ('general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other')
    );





