-- ============================================================
-- UNIFICARD - MIGRATION 159
-- Tabela: publication_audit_log
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela append-only (imutável) para auditoria de mudanças
-- em publicação, visibilidade e convites.
--
-- REGRAS CANÔNICAS:
-- - Append-only: registros nunca são deletados ou modificados
-- - Toda mudança relevante deve ser logada
-- - Payload JSONB para flexibilidade futura
--
-- ============================================================

CREATE TABLE IF NOT EXISTS publication_audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('event', 'post', 'group', 'channel')),
    entity_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Ação realizada
    action VARCHAR(100) NOT NULL CHECK (
        action IN (
            'SET_VISIBILITY',
            'SET_DESTINATIONS',
            'ENABLE_INVITATIONS',
            'DISABLE_INVITATIONS',
            'SET_INVITATION_METHODS',
            'SEND_INVITES',
            'GENERATE_LINK',
            'REACTION',
            'VIEW',
            'CLICK',
            'SHARE'
        )
    ),
    
    -- Payload flexível (JSONB)
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Exemplos:
    -- {"old_visibility": "public", "new_visibility": "private"}
    -- {"destinations": ["feed", "profile"], "method": "internal"}
    -- {"invitation_count": 10, "method": "whatsapp"}
    -- {"link": "https://...", "referral_code": "ABC123"}
    -- {"reaction_type": "like", "user_id": "..."}
    
    -- Quem realizou a ação
    actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE RESTRICT,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'page', 'group', 'channel')),
    
    -- Quando
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_publication_audit_log_entity ON publication_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_publication_audit_log_action ON publication_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_publication_audit_log_created_at ON publication_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_audit_log_tenant ON publication_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_publication_audit_log_actor ON publication_audit_log(actor_id, actor_type);

-- Índice GIN para busca em payload
CREATE INDEX IF NOT EXISTS idx_publication_audit_log_payload ON publication_audit_log USING GIN (payload);

-- Comentários para documentação
COMMENT ON TABLE publication_audit_log IS 'Log append-only (imutável) de auditoria para publicação, visibilidade e convites.';
COMMENT ON COLUMN publication_audit_log.action IS 'Tipo de ação: SET_VISIBILITY, SET_DESTINATIONS, SEND_INVITES, GENERATE_LINK, REACTION, etc.';
COMMENT ON COLUMN publication_audit_log.payload IS 'Payload JSONB flexível com detalhes da ação (old/new values, counts, links, etc.)';
COMMENT ON COLUMN publication_audit_log.actor_id IS 'ID do actor que realizou a ação';
COMMENT ON COLUMN publication_audit_log.actor_type IS 'Tipo do actor que realizou a ação';



