-- ============================================================
-- UNIFICARD - MIGRATION 188
-- SPRINT 53: FISCAL PROVIDER SEFAZ - Registro de Tentativas
-- Tabela: fiscal_provider_attempts
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela append-only para registrar todas as tentativas
-- de emissão/cancelamento/consulta com providers fiscais.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Append-only (sem UPDATE/DELETE)
-- - Registra TODAS as tentativas (SUCCESS, FAILED, SKIPPED)
-- - Auditável e rastreável
-- ============================================================

-- ============================================================
-- ENUM: Provider fiscal
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_provider_type') THEN
        CREATE TYPE fiscal_provider_type AS ENUM (
            'mock',  -- Provider mock
            'sefaz'  -- Provider SEFAZ
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Ação do provider
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_provider_action') THEN
        CREATE TYPE fiscal_provider_action AS ENUM (
            'ISSUE',   -- Emissão
            'CANCEL',  -- Cancelamento
            'STATUS'   -- Consulta de status
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Status da tentativa
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_provider_attempt_status') THEN
        CREATE TYPE fiscal_provider_attempt_status AS ENUM (
            'SUCCESS',  -- Sucesso
            'FAILED',   -- Falha
            'SKIPPED'   -- Pulado (ex: SEFAZ_ENABLED=false)
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: fiscal_provider_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_provider_attempts (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Documento fiscal associado
    fiscal_document_id UUID NOT NULL
        REFERENCES fiscal_documents(id) ON DELETE RESTRICT,
    
    -- Provider usado
    provider fiscal_provider_type NOT NULL,
    
    -- Ação executada
    action fiscal_provider_action NOT NULL,
    
    -- Status da tentativa
    status fiscal_provider_attempt_status NOT NULL,
    
    -- Código de erro (opcional)
    error_code VARCHAR(100),
    
    -- Mensagem de erro (opcional)
    error_message TEXT,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_fiscal_provider_attempts_tenant
    ON fiscal_provider_attempts (tenant_id);

-- Índice para buscar por documento fiscal
CREATE INDEX IF NOT EXISTS idx_fiscal_provider_attempts_document
    ON fiscal_provider_attempts (tenant_id, fiscal_document_id);

-- Índice para buscar por provider e status
CREATE INDEX IF NOT EXISTS idx_fiscal_provider_attempts_provider_status
    ON fiscal_provider_attempts (tenant_id, provider, status);

-- Índice composto para listagem comum
CREATE INDEX IF NOT EXISTS idx_fiscal_provider_attempts_document_action_created
    ON fiscal_provider_attempts (tenant_id, fiscal_document_id, action, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE fiscal_provider_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY fiscal_provider_attempts_rls ON fiscal_provider_attempts
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Prevenir UPDATE/DELETE (append-only)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_fiscal_provider_attempt_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'fiscal_provider_attempts is immutable (append-only). UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Trigger para prevenir UPDATE
CREATE TRIGGER prevent_fiscal_provider_attempts_update
    BEFORE UPDATE ON fiscal_provider_attempts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_fiscal_provider_attempt_modification();

-- Trigger para prevenir DELETE
CREATE TRIGGER prevent_fiscal_provider_attempts_delete
    BEFORE DELETE ON fiscal_provider_attempts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_fiscal_provider_attempt_modification();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE fiscal_provider_attempts IS
    'Tentativas de emissão/cancelamento/consulta com providers fiscais. Append-only, auditável.';

COMMENT ON COLUMN fiscal_provider_attempts.provider IS
    'Provider usado: mock ou sefaz.';

COMMENT ON COLUMN fiscal_provider_attempts.action IS
    'Ação executada: ISSUE (emissão), CANCEL (cancelamento), STATUS (consulta).';

COMMENT ON COLUMN fiscal_provider_attempts.status IS
    'Status da tentativa: SUCCESS (sucesso), FAILED (falha), SKIPPED (pulado).';

COMMENT ON COLUMN fiscal_provider_attempts.error_code IS
    'Código de erro (opcional). Registrado quando status = FAILED.';

COMMENT ON COLUMN fiscal_provider_attempts.error_message IS
    'Mensagem de erro (opcional). Registrado quando status = FAILED.';

COMMENT ON COLUMN fiscal_provider_attempts.metadata IS
    'Metadados adicionais: payload enviado, resposta recebida, etc.';







