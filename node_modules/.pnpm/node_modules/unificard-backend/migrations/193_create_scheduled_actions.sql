-- ============================================================
-- UNIFICARD - MIGRATION 193
-- SPRINT 67: SCHEDULED ACTIONS (AUTOMAÇÃO PROGRAMADA E AUDITÁVEL)
-- Tabela: scheduled_actions
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de ações programadas que:
-- - NÃO decide se executa
-- - NÃO cria economia nova
-- - NÃO executa nada automaticamente sem trilho
-- - É totalmente auditável, cancelável e governado por policy
--
-- REGRAS:
-- - Append-only (status muda, mas registros não desaparecem)
-- - Sem heurística
-- - Sem IA
-- - Sem execução silenciosa
-- - Toda execução deve gerar audit event
-- - Falha nunca bloqueia sistema
-- ============================================================

-- ============================================================
-- ENUM: Action Type
-- ============================================================
CREATE TYPE scheduled_action_type AS ENUM (
  'PAYMENT_EXECUTION',
  'FISCAL_ISSUE',
  'PAYOUT_EXECUTION'
);

-- ============================================================
-- ENUM: Action Status
-- ============================================================
CREATE TYPE scheduled_action_status AS ENUM (
  'SCHEDULED',
  'EXECUTED',
  'CANCELLED',
  'FAILED'
);

-- ============================================================
-- TABELA: scheduled_actions
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_actions (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Tipo de ação
    action_type scheduled_action_type NOT NULL,
    
    -- Referência (tipo flexível: payment_intent, fiscal_document, etc.)
    reference_type VARCHAR(50) NOT NULL, -- Ex: 'payment_intent', 'fiscal_document', 'payout'
    reference_id UUID NOT NULL,
    
    -- Agendamento
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status
    status scheduled_action_status NOT NULL DEFAULT 'SCHEDULED',
    
    -- Policy snapshot (JSONB) - snapshot da policy no momento do agendamento
    policy_snapshot JSONB,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID, -- Opcional: usuário que criou
    
    -- Execução
    executed_at TIMESTAMP WITH TIME ZONE,
    execution_error_code VARCHAR(50), -- Código de erro se falhou
    execution_error_message TEXT, -- Mensagem de erro se falhou
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar ações vencidas (status = SCHEDULED, scheduled_for <= now)
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_due
    ON scheduled_actions(tenant_id, status, scheduled_for)
    WHERE status = 'SCHEDULED';

-- Índice para buscar por referência
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_reference
    ON scheduled_actions(tenant_id, reference_type, reference_id);

-- Índice para buscar por tipo de ação
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_type
    ON scheduled_actions(tenant_id, action_type, status);

-- Índice para auditoria (buscar por criador)
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_creator
    ON scheduled_actions(tenant_id, created_by_actor_id, created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE scheduled_actions ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem ações do próprio tenant
CREATE POLICY scheduled_actions_tenant_isolation
    ON scheduled_actions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_scheduled_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scheduled_actions_updated_at
    BEFORE UPDATE ON scheduled_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_actions_updated_at();

-- ============================================================
-- CONSTRAINTS
-- ============================================================
-- scheduled_for deve ser no futuro (ou presente) quando status = SCHEDULED
-- Nota: Não forçamos isso via constraint, mas validamos no service

-- executed_at só pode ser preenchido se status = EXECUTED ou FAILED
ALTER TABLE scheduled_actions
    ADD CONSTRAINT check_executed_at_status
    CHECK (
        (executed_at IS NULL AND status IN ('SCHEDULED', 'CANCELLED')) OR
        (executed_at IS NOT NULL AND status IN ('EXECUTED', 'FAILED'))
    );

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE scheduled_actions IS 'Ações programadas para execução futura. Append-only: status muda, mas registros não desaparecem.';
COMMENT ON COLUMN scheduled_actions.action_type IS 'Tipo de ação a ser executada';
COMMENT ON COLUMN scheduled_actions.reference_type IS 'Tipo da referência (ex: payment_intent, fiscal_document)';
COMMENT ON COLUMN scheduled_actions.reference_id IS 'ID da referência (ex: payment_intent_id, fiscal_document_id)';
COMMENT ON COLUMN scheduled_actions.scheduled_for IS 'Data/hora agendada para execução';
COMMENT ON COLUMN scheduled_actions.policy_snapshot IS 'Snapshot da policy no momento do agendamento (para auditoria)';
COMMENT ON COLUMN scheduled_actions.execution_error_code IS 'Código de erro se execução falhou';
COMMENT ON COLUMN scheduled_actions.execution_error_message IS 'Mensagem de erro se execução falhou';







