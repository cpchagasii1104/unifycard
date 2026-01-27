-- ============================================================
-- UNIFICARD - MIGRATION 156
-- SPRINT 13: Piloto Controlado & Observação Silenciosa
-- Tabela: pilot_events
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para armazenar eventos de observação do modo piloto.
-- Eventos são registrados apenas quando PILOT_MODE está ativo.
-- Não armazena dados pessoais sensíveis, apenas ocorrências.
--
-- REGRAS:
-- - Apenas ativo quando PILOT_MODE=true
-- - Não armazena conteúdo sensível
-- - Apenas timestamp + actor + tipo de evento
-- - Não usado para otimização automática
-- ============================================================

-- ============================================================
-- TABELA: pilot_events
-- ============================================================
CREATE TABLE IF NOT EXISTS pilot_events (
    -- Identificação
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Tipo de evento observado
    event_type VARCHAR(50) NOT NULL
        CHECK (event_type IN (
            'first_action_executed',
            'first_company_created',
            'first_delegation',
            'first_dispute_opened',
            'first_transaction',
            'first_group_allocation',
            'first_workflow_completed',
            'first_member_invited',
            -- SPRINT 14: Eventos de fricção
            'invite_not_used',
            'signup_abandoned',
            'first_action_timeout',
            'workflow_started_not_completed'
        )),
    
    -- Actor que executou a ação (apenas ID, não dados pessoais)
    actor_id UUID NOT NULL,
    actor_type VARCHAR(20) NOT NULL
        CHECK (actor_type IN ('user', 'page', 'group', 'company')),
    
    -- Timestamp do evento
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Metadata opcional (sem dados sensíveis)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp de criação
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pilot_events_tenant_id 
    ON pilot_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_pilot_events_event_type 
    ON pilot_events(event_type);

CREATE INDEX IF NOT EXISTS idx_pilot_events_actor_id 
    ON pilot_events(actor_id);

CREATE INDEX IF NOT EXISTS idx_pilot_events_occurred_at 
    ON pilot_events(occurred_at DESC);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_pilot_events_tenant_type_occurred 
    ON pilot_events(tenant_id, event_type, occurred_at DESC);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE pilot_events IS 
    'Eventos de observação do modo piloto - apenas ocorrências, sem dados sensíveis';

COMMENT ON COLUMN pilot_events.event_type IS 
    'Tipo de evento observado (first_action_executed, first_company_created, etc)';

COMMENT ON COLUMN pilot_events.actor_id IS 
    'ID do actor que executou a ação (não armazena dados pessoais)';

COMMENT ON COLUMN pilot_events.metadata IS 
    'Metadata opcional sem dados pessoais sensíveis';

