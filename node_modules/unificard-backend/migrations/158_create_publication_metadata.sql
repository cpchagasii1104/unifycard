-- ============================================================
-- UNIFICARD - MIGRATION 158
-- Tabela: publication_metadata
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela transversal para gerenciar publicação, visibilidade
-- e convites de entidades (eventos, posts, grupos, etc.)
--
-- REGRAS CANÔNICAS:
-- - Separar: VISIBILIDADE (acesso) ≠ PUBLICAÇÃO (destinos) ≠ CONVITE (notificação/envio)
-- - Nada de decisões automáticas por categoria/subtipo
-- - Database é estado, não verdade; mudanças auditáveis
--
-- ============================================================

CREATE TABLE IF NOT EXISTS publication_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('event', 'post', 'group', 'channel')),
    entity_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- VISIBILIDADE (acesso)
    visibility VARCHAR(50) NOT NULL DEFAULT 'public' CHECK (
        visibility IN ('public', 'private', 'unlisted', 'followers', 'group', 'friends')
    ),
    
    -- PUBLICAÇÃO (destinos onde aparece)
    publication_destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Valores possíveis: 'feed', 'group_feed', 'event_feed', 'profile', 'search', 'none'
    -- Exemplo: ["feed", "profile", "search"]
    
    -- CONVITES (notificação/envio)
    invitations_enabled BOOLEAN NOT NULL DEFAULT false,
    invitation_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Valores possíveis: 'internal', 'whatsapp', 'email', 'shareable_link', 'external_with_signup'
    -- Exemplo: ["internal", "whatsapp", "shareable_link"]
    
    -- Código de indicação (opcional, marketing informativo)
    referral_code VARCHAR(100) NULL,
    
    -- Auditoria
    created_by_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE RESTRICT,
    created_by_actor_type VARCHAR(20) NOT NULL CHECK (created_by_actor_type IN ('user', 'page', 'group', 'channel')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: uma entidade só pode ter um registro de publicação
    CONSTRAINT unique_entity_publication UNIQUE (entity_type, entity_id)
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_publication_metadata_entity ON publication_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_publication_metadata_visibility ON publication_metadata(visibility);
CREATE INDEX IF NOT EXISTS idx_publication_metadata_tenant ON publication_metadata(tenant_id);
CREATE INDEX IF NOT EXISTS idx_publication_metadata_created_by ON publication_metadata(created_by_actor_id, created_by_actor_type);

-- Índices GIN para arrays JSONB
CREATE INDEX IF NOT EXISTS idx_publication_metadata_destinations ON publication_metadata USING GIN (publication_destinations);
CREATE INDEX IF NOT EXISTS idx_publication_metadata_invitation_methods ON publication_metadata USING GIN (invitation_methods);

-- Índice para referral_code (busca por código)
CREATE INDEX IF NOT EXISTS idx_publication_metadata_referral ON publication_metadata(referral_code) WHERE referral_code IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_publication_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_publication_metadata_updated_at
    BEFORE UPDATE ON publication_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_publication_metadata_updated_at();

-- Comentários para documentação
COMMENT ON TABLE publication_metadata IS 'Metadados de publicação, visibilidade e convites para entidades (eventos, posts, grupos).';
COMMENT ON COLUMN publication_metadata.entity_type IS 'Tipo da entidade: event, post, group, channel';
COMMENT ON COLUMN publication_metadata.entity_id IS 'ID da entidade (UUID)';
COMMENT ON COLUMN publication_metadata.visibility IS 'Nível de visibilidade/acesso: public, private, unlisted, followers, group, friends';
COMMENT ON COLUMN publication_metadata.publication_destinations IS 'Array JSONB de destinos onde a entidade aparece: feed, group_feed, event_feed, profile, search, none';
COMMENT ON COLUMN publication_metadata.invitations_enabled IS 'Se convites estão habilitados para esta entidade';
COMMENT ON COLUMN publication_metadata.invitation_methods IS 'Array JSONB de métodos de convite: internal, whatsapp, email, shareable_link, external_with_signup';
COMMENT ON COLUMN publication_metadata.referral_code IS 'Código de indicação opcional para marketing (não-bloqueante)';



