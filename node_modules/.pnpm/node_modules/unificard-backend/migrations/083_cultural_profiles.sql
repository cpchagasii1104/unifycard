-- Migration: 083_cultural_profiles.sql
-- FASE 16: Cultura & Eventos - Perfis de Atuação Cultural (PAC)
-- Cria tabela para representar atores culturais sem criar novos tipos de usuário

-- Tabela de Perfis de Atuação Cultural (PAC)
CREATE TABLE IF NOT EXISTS cultural_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    owner_actor_id VARCHAR(255) NOT NULL, -- ID do ator base (PF ou PJ)
    owner_actor_type VARCHAR(20) NOT NULL CHECK (owner_actor_type IN ('user', 'page')),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'ARTIST', 'BAND', 'BAR', 'VENUE', 'COLLECTIVE', 
        'PRODUCER', 'CIRCLE', 'EDUCATOR', 'CURATOR'
    )),
    display_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL, -- URL-friendly identifier
    description TEXT,
    linked_company_id UUID REFERENCES companies(company_id) ON DELETE SET NULL,
    location JSONB, -- { city, state, address, lat, lng }
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Garantir slug único por tenant
    CONSTRAINT cultural_profiles_slug_unique UNIQUE (tenant_id, slug),
    
    -- Garantir que owner existe (validação lógica, não FK)
    CONSTRAINT cultural_profiles_owner_check CHECK (owner_actor_id IS NOT NULL AND owner_actor_id != '')
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_cultural_profiles_owner ON cultural_profiles(tenant_id, owner_actor_id, owner_actor_type);
CREATE INDEX IF NOT EXISTS idx_cultural_profiles_type ON cultural_profiles(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_cultural_profiles_company ON cultural_profiles(tenant_id, linked_company_id) WHERE linked_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cultural_profiles_slug ON cultural_profiles(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_cultural_profiles_active ON cultural_profiles(tenant_id, active) WHERE active = true;

-- Comentários
COMMENT ON TABLE cultural_profiles IS 'Perfis de Atuação Cultural (PAC) - Representa atores culturais sem criar novos tipos de usuário';
COMMENT ON COLUMN cultural_profiles.owner_actor_id IS 'ID do ator base (PF ou PJ) que possui este perfil cultural';
COMMENT ON COLUMN cultural_profiles.owner_actor_type IS 'Tipo do ator base: user (PF) ou page (PJ)';
COMMENT ON COLUMN cultural_profiles.type IS 'Tipo cultural: ARTIST, BAND, BAR, VENUE, COLLECTIVE, PRODUCER, CIRCLE, EDUCATOR, CURATOR';
COMMENT ON COLUMN cultural_profiles.slug IS 'Identificador URL-friendly único por tenant (ex: @banda-rock)';
COMMENT ON COLUMN cultural_profiles.linked_company_id IS 'Empresa vinculada (obrigatório para BAR/VENUE, opcional para outros)';
COMMENT ON COLUMN cultural_profiles.location IS 'Localização física em JSON: { city, state, address, lat, lng }';













