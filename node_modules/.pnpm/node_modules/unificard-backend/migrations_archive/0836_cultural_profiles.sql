-- ============================================================
-- UNIFICARD - MIGRATION 083
-- FASE 16: Cultura & Eventos - Perfis de Atuação Cultural (PAC)
-- ============================================================
--
-- OBJETIVO:
-- Representar perfis de atuação cultural (PAC) como extensões
-- semânticas de atores existentes (user/page), sem criar novos
-- tipos de identidade no sistema.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - cultural_profiles NÃO cria novo ator
-- - É uma camada cultural associada a um actor existente
-- - O BANCO:
--   • garante unicidade (slug por tenant)
--   • garante integridade estrutural
-- - A APLICAÇÃO:
--   • valida coerência entre type e linked_company_id
--   • controla ciclo de vida (active)
--   • atualiza updated_at
--
-- DECISÕES IMPORTANTES:
-- - Campo type é propositalmente livre (sem CHECK rígido)
--   para permitir expansão cultural sem migrations traumáticas
-- - owner_actor_id NÃO possui FK (ator é polimórfico)
-- - linked_company_id é opcional no schema
--   (obrigatoriedade por tipo é regra de domínio)
--
-- DEPENDÊNCIAS:
-- - tenants
-- - companies
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- TABELA DE PERFIS DE ATUAÇÃO CULTURAL (PAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS cultural_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    owner_actor_id VARCHAR(255) NOT NULL,
    owner_actor_type VARCHAR(20) NOT NULL
        CHECK (owner_actor_type IN ('user', 'page')),

    type VARCHAR(50) NOT NULL,

    display_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,

    description TEXT,

    linked_company_id UUID
        REFERENCES companies(company_id) ON DELETE SET NULL,

    location JSONB,

    active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT cultural_profiles_slug_unique
        UNIQUE (tenant_id, slug),

    CONSTRAINT cultural_profiles_owner_check
        CHECK (owner_actor_id <> '')
);


-- ============================================================
-- ÍNDICES ÚTEIS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cultural_profiles_owner
    ON cultural_profiles (tenant_id, owner_actor_id, owner_actor_type);

CREATE INDEX IF NOT EXISTS idx_cultural_profiles_type
    ON cultural_profiles (tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_cultural_profiles_company
    ON cultural_profiles (tenant_id, linked_company_id)
    WHERE linked_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cultural_profiles_active
    ON cultural_profiles (tenant_id, active)
    WHERE active = true;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE cultural_profiles IS
    'Perfis de Atuação Cultural (PAC). Extensão cultural de atores existentes, sem criar nova identidade.';

COMMENT ON COLUMN cultural_profiles.owner_actor_id IS
    'ID do ator base (user ou page) que possui este perfil cultural.';

COMMENT ON COLUMN cultural_profiles.owner_actor_type IS
    'Tipo do ator base: user (PF) ou page (PJ).';

COMMENT ON COLUMN cultural_profiles.type IS
    'Categoria cultural do perfil (ex: ARTIST, BAND, BAR, VENUE, COLLECTIVE, etc). Valor livre para expansão futura.';

COMMENT ON COLUMN cultural_profiles.slug IS
    'Identificador URL-friendly único por tenant (ex: @banda-rock).';

COMMENT ON COLUMN cultural_profiles.linked_company_id IS
    'Empresa vinculada ao perfil cultural. Obrigatoriedade depende do tipo (regra da aplicação).';

COMMENT ON COLUMN cultural_profiles.location IS
    'Localização física em JSON (city, state, address, lat, lng).';













