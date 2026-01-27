-- ============================================================
-- UNIFICARD - MIGRATION 154
-- CONTINUOUS PRODUCTION: Actor Registry
-- Tabela: actor_registry
-- ============================================================
--
-- OBJETIVO:
-- Criar Actor Registry como ADAPTER (não novo sistema).
-- Mapeia entidades existentes (companies, events, groups, services, projects)
-- para actors com capabilities.
--
-- REGRAS:
-- - NÃO duplica tabelas existentes
-- - Apenas registra mapeamento entity → actor_id + capabilities
-- - Usado pelo sistema de delegação
-- ============================================================

-- ============================================================
-- TABELA: actor_registry
-- ============================================================
CREATE TABLE IF NOT EXISTS actor_registry (
    -- Identificação
    registry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor ID (referência à tabela actors existente)
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Tipo de actor (company, event, group, service, project)
    actor_type VARCHAR(20) NOT NULL
        CHECK (actor_type IN ('company', 'event', 'group', 'service', 'project')),
    
    -- Tabela da entidade original
    entity_table VARCHAR(50) NOT NULL,
    
    -- ID da entidade original
    entity_id UUID NOT NULL,
    
    -- Capabilities (JSON)
    capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: único registro por actor
    CONSTRAINT unique_actor_registry UNIQUE (tenant_id, actor_id),
    
    -- Constraint: único registro por entidade
    CONSTRAINT unique_entity_registry UNIQUE (tenant_id, entity_table, entity_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por actor_id
CREATE INDEX IF NOT EXISTS idx_actor_registry_actor
    ON actor_registry (tenant_id, actor_id);

-- Índice para busca por entidade
CREATE INDEX IF NOT EXISTS idx_actor_registry_entity
    ON actor_registry (tenant_id, entity_table, entity_id);

-- Índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_actor_registry_type
    ON actor_registry (tenant_id, actor_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE actor_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY actor_registry_rls ON actor_registry
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_actor_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actor_registry_updated_at
    BEFORE UPDATE ON actor_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_actor_registry_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE actor_registry IS
    'Actor Registry - Adapter que mapeia entidades existentes para actors com capabilities';

COMMENT ON COLUMN actor_registry.actor_id IS
    'ID do actor na tabela actors (existente)';

COMMENT ON COLUMN actor_registry.actor_type IS
    'Tipo de actor institucional (company, event, group, service, project)';

COMMENT ON COLUMN actor_registry.entity_table IS
    'Nome da tabela da entidade original (companies, events, groups, services, projects)';

COMMENT ON COLUMN actor_registry.entity_id IS
    'ID da entidade original';

COMMENT ON COLUMN actor_registry.capabilities_json IS
    'Capabilities do actor em JSON: {can_receive_funds, can_publish_feed, can_delegate, can_hold_assets}';







