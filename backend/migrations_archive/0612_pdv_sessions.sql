-- ============================================================
-- UNIFICARD - MIGRATION 179
-- SPRINT 42.1: PDV CORE - Venda por Peso + Caixa Simples
-- Tabela: pdv_sessions
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para sessões de PDV (Ponto de Venda).
-- PDV é apenas um canal de entrada para o marketplace.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - PDV Session representa um caixa aberto
-- - Nenhuma lógica financeira aqui
-- - PDV usa Order do marketplace (não cria sistema paralelo)
-- ============================================================

-- ============================================================
-- ENUM: Status da sessão PDV
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pdv_session_status') THEN
        CREATE TYPE pdv_session_status AS ENUM (
            'OPEN',     -- Caixa aberto
            'CLOSED'    -- Caixa fechado
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: pdv_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS pdv_sessions (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que está operando o caixa
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Status da sessão
    status pdv_session_status NOT NULL DEFAULT 'OPEN',
    
    -- Timestamps
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps de auditoria
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_pdv_sessions_tenant
    ON pdv_sessions (tenant_id);

-- Índice para buscar por actor
CREATE INDEX IF NOT EXISTS idx_pdv_sessions_actor
    ON pdv_sessions (tenant_id, actor_id);

-- Índice para buscar sessões abertas
CREATE INDEX IF NOT EXISTS idx_pdv_sessions_open
    ON pdv_sessions (tenant_id, actor_id, status)
    WHERE status = 'OPEN';

-- Índice para buscar por data de abertura
CREATE INDEX IF NOT EXISTS idx_pdv_sessions_opened_at
    ON pdv_sessions (tenant_id, opened_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE pdv_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdv_sessions_rls ON pdv_sessions
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER pdv_sessions_updated_at
    BEFORE UPDATE ON pdv_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE pdv_sessions IS
    'Sessões de PDV (Ponto de Venda). Representa um caixa aberto. Nenhuma lógica financeira aqui.';

COMMENT ON COLUMN pdv_sessions.actor_id IS
    'Actor que está operando o caixa (funcionário/operador).';

COMMENT ON COLUMN pdv_sessions.status IS
    'Status da sessão: OPEN (caixa aberto) ou CLOSED (caixa fechado).';

COMMENT ON COLUMN pdv_sessions.metadata IS
    'Metadados adicionais da sessão (ex: observações, configurações).';







