-- ============================================================
-- UNIFICARD - MIGRATION 253
-- SPRINT: Saúde V3 - Modelo Relacional
-- Tabelas: health_taxonomies, user_health_facts, health_consents
-- ============================================================
--
-- OBJETIVO:
-- Criar modelo relacional de saúde inspirado em "Interesses e Gostos",
-- permitindo matching avançado com clínicas, odontologia, visão, etc.
--
-- PRINCÍPIOS:
-- 1) Saúde NÃO usa categories genérico
-- 2) Taxonomia própria e controlada (health_taxonomies)
-- 3) Fatos do usuário separados (user_health_facts)
-- 4) Consentimento isolado e auditável (health_consents)
-- 5) NÃO quebra UX atual, NÃO remove campos existentes
-- ============================================================

-- ============================================================
-- TABELA: health_taxonomies
-- Taxonomia controlada de saúde (o que o sistema entende)
-- ============================================================
CREATE TABLE IF NOT EXISTS health_taxonomies (
    -- Identificação
    taxonomy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Nome da taxonomia (ex: "Miopia", "Diabetes Tipo 2", "Uso de Óculos")
    name VARCHAR(255) NOT NULL,
    
    -- Slug (URL-friendly, único por tenant)
    slug VARCHAR(255) NOT NULL,
    
    -- Categoria/domínio (ex: "vision", "general", "medications", "dental")
    category VARCHAR(50) NOT NULL,
    
    -- Tipo de fato (ex: "condition", "medication", "device", "service_need")
    fact_type VARCHAR(50) NOT NULL DEFAULT 'condition',
    
    -- Hierarquia opcional (parent_id para subcategorias)
    parent_id UUID REFERENCES health_taxonomies(taxonomy_id) ON DELETE SET NULL,
    
    -- Descrição
    description TEXT,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_health_taxonomy_slug_per_tenant UNIQUE (tenant_id, slug),
    CONSTRAINT health_taxonomies_category_check CHECK (
        category IN ('general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other')
    ),
    CONSTRAINT health_taxonomies_fact_type_check CHECK (
        fact_type IN ('condition', 'medication', 'device', 'service_need', 'allergy', 'other')
    )
);

-- ============================================================
-- ÍNDICES: health_taxonomies
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_health_taxonomies_tenant
    ON health_taxonomies(tenant_id);

CREATE INDEX IF NOT EXISTS idx_health_taxonomies_category
    ON health_taxonomies(tenant_id, category, is_active);

CREATE INDEX IF NOT EXISTS idx_health_taxonomies_fact_type
    ON health_taxonomies(tenant_id, fact_type, is_active);

CREATE INDEX IF NOT EXISTS idx_health_taxonomies_parent
    ON health_taxonomies(parent_id)
    WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_taxonomies_slug
    ON health_taxonomies(tenant_id, slug);

-- ============================================================
-- TABELA: user_health_facts
-- Fatos declarados pelo usuário (o que ele declara)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_health_facts (
    -- Identificação
    fact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que está declarando (activeActor)
    actor_id UUID NOT NULL,
    
    -- Vínculo com taxonomia
    taxonomy_id UUID NOT NULL
        REFERENCES health_taxonomies(taxonomy_id) ON DELETE CASCADE,
    
    -- Valor declarado (pode ser texto livre, número, boolean, etc.)
    -- Ex: "Grau -2.5", "Sim", "50mg", "2024-01-01"
    value_text TEXT,
    value_number NUMERIC,
    value_boolean BOOLEAN,
    value_date DATE,
    
    -- Observações adicionais
    notes TEXT,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Vínculo opcional com health_declaration (para rastreabilidade)
    health_declaration_id UUID REFERENCES health_declarations(id) ON DELETE SET NULL,
    
    -- Timestamps de auditoria
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT user_health_facts_unique_per_actor_taxonomy UNIQUE (tenant_id, actor_id, taxonomy_id),
    CONSTRAINT user_health_facts_value_check CHECK (
        (value_text IS NOT NULL)::int +
        (value_number IS NOT NULL)::int +
        (value_boolean IS NOT NULL)::int +
        (value_date IS NOT NULL)::int = 1
    )
);

-- ============================================================
-- ÍNDICES: user_health_facts
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_health_facts_tenant_actor
    ON user_health_facts(tenant_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_health_facts_taxonomy
    ON user_health_facts(tenant_id, taxonomy_id, actor_id);

CREATE INDEX IF NOT EXISTS idx_user_health_facts_category
    ON user_health_facts(tenant_id, actor_id)
    INCLUDE (taxonomy_id);

CREATE INDEX IF NOT EXISTS idx_user_health_facts_declaration
    ON user_health_facts(health_declaration_id)
    WHERE health_declaration_id IS NOT NULL;

-- Índice GIN para queries JSONB no metadata
CREATE INDEX IF NOT EXISTS idx_user_health_facts_metadata_gin
    ON user_health_facts USING GIN (metadata)
    WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;

-- ============================================================
-- TABELA: health_consents
-- Consentimentos isolados e auditáveis
-- ============================================================
CREATE TABLE IF NOT EXISTS health_consents (
    -- Identificação
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que está consentindo (activeActor)
    actor_id UUID NOT NULL,
    
    -- Escopo do consentimento (ex: "vision", "dental", "general", "all")
    consent_scope VARCHAR(50) NOT NULL,
    
    -- Status do consentimento
    is_consented BOOLEAN NOT NULL DEFAULT false,
    
    -- Data de consentimento
    consented_at TIMESTAMP WITH TIME ZONE,
    
    -- Data de revogação (se aplicável)
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    -- IP e user agent (auditoria)
    ip_address INET,
    user_agent TEXT,
    
    -- Observações
    notes TEXT,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps de auditoria
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT health_consents_scope_check CHECK (
        consent_scope IN ('general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other', 'all')
    ),
    CONSTRAINT health_consents_consented_check CHECK (
        (is_consented = true AND consented_at IS NOT NULL) OR
        (is_consented = false)
    )
);

-- ============================================================
-- ÍNDICES: health_consents
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_health_consents_tenant_actor
    ON health_consents(tenant_id, actor_id, consent_scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_consents_scope
    ON health_consents(tenant_id, actor_id, consent_scope, is_consented);

CREATE INDEX IF NOT EXISTS idx_health_consents_active
    ON health_consents(tenant_id, actor_id, is_consented, consent_scope)
    WHERE is_consented = true AND revoked_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE health_taxonomies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_health_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_consents ENABLE ROW LEVEL SECURITY;

-- RLS para health_taxonomies (leitura pública, escrita admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'health_taxonomies'
      AND policyname = 'health_taxonomies_rls'
  ) THEN
    CREATE POLICY health_taxonomies_rls
      ON health_taxonomies
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- RLS para user_health_facts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'user_health_facts'
      AND policyname = 'user_health_facts_rls'
  ) THEN
    CREATE POLICY user_health_facts_rls
      ON user_health_facts
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- RLS para health_consents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'health_consents'
      AND policyname = 'health_consents_rls'
  ) THEN
    CREATE POLICY health_consents_rls
      ON health_consents
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_health_taxonomies_updated_at ON health_taxonomies;
CREATE TRIGGER trg_health_taxonomies_updated_at
  BEFORE UPDATE ON health_taxonomies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_health_facts_updated_at ON user_health_facts;
CREATE TRIGGER trg_user_health_facts_updated_at
  BEFORE UPDATE ON user_health_facts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_health_consents_updated_at ON health_consents;
CREATE TRIGGER trg_health_consents_updated_at
  BEFORE UPDATE ON health_consents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE health_taxonomies IS 
    'Taxonomia controlada de saúde - o que o sistema entende (ex: "Miopia", "Diabetes Tipo 2")';

COMMENT ON TABLE user_health_facts IS 
    'Fatos declarados pelo usuário - o que ele declara (relacional, ligando usuário + taxonomia)';

COMMENT ON TABLE health_consents IS 
    'Consentimentos isolados e auditáveis - trilha completa de LGPD';

COMMENT ON COLUMN user_health_facts.health_declaration_id IS 
    'Vínculo opcional com health_declarations para rastreabilidade (compatibilidade com modelo anterior)';

COMMENT ON COLUMN health_consents.consent_scope IS 
    'Escopo do consentimento: general, vision, dental, medications, mobility, mental, other, all';

COMMENT ON COLUMN health_consents.consented_at IS 
    'Data/hora do consentimento (obrigatório quando is_consented = true)';

COMMENT ON COLUMN health_consents.revoked_at IS 
    'Data/hora da revogação (quando usuário revoga consentimento)';





