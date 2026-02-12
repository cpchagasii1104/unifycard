-- ============================================================
-- UNIFICARD - MIGRATION 162
-- Tabela: event_actions_log
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela append-only para tracking de ações em eventos (observabilidade passiva).
--
-- REGRAS CANÔNICAS:
-- - Apenas log (append-only)
-- - NÃO altera UX
-- - NÃO altera ranking
-- - NÃO altera visibilidade
--
-- ============================================================

CREATE TABLE IF NOT EXISTS event_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Usuário que realizou a ação (nullable para ações anônimas)
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Tipo de ação
    action_type VARCHAR(50) NOT NULL CHECK (
        action_type IN (
            'rsvp_yes',
            'rsvp_no',
            'rsvp_maybe',
            'calendar_add',
            'contribute_click',
            'share_click',
            'view',
            'link_open'
        )
    ),
    
    -- Metadados adicionais (JSONB flexível)
    metadata JSONB NULL DEFAULT '{}'::jsonb,
    -- Exemplos:
    -- {"calendar_type": "ics", "referral_code": "ABC123"}
    -- {"contribution_amount": 5000, "currency": "BRL"}
    -- {"share_method": "whatsapp", "referral_code": "XYZ789"}
    
    -- Quando
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_event_actions_log_event ON event_actions_log(event_id);
CREATE INDEX IF NOT EXISTS idx_event_actions_log_user ON event_actions_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_actions_log_tenant ON event_actions_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_actions_log_action_type ON event_actions_log(action_type);
CREATE INDEX IF NOT EXISTS idx_event_actions_log_created_at ON event_actions_log(created_at DESC);

-- Índice GIN para busca em metadata
CREATE INDEX IF NOT EXISTS idx_event_actions_log_metadata ON event_actions_log USING GIN (metadata);

-- Comentários para documentação
COMMENT ON TABLE event_actions_log IS 'Log append-only de ações em eventos (observabilidade passiva). Não altera UX, ranking ou visibilidade.';
COMMENT ON COLUMN event_actions_log.action_type IS 'Tipo de ação: rsvp_yes, rsvp_no, rsvp_maybe, calendar_add, contribute_click, share_click, view, link_open';
COMMENT ON COLUMN event_actions_log.metadata IS 'Metadados adicionais da ação (JSONB flexível)';
COMMENT ON COLUMN event_actions_log.user_id IS 'ID do usuário (nullable para ações anônimas ou de convidados externos)';



