/*
Arquivo: 034_memory_engine.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Módulo: Memory Engine

Função do arquivo:
- Persistir memória consolidada do usuário global
- Armazenar preferências, hábitos, entidades recorrentes e atalhos
- Servir como base de personalização para IA, CARE e Orchestrator

Escopo:
- Preferências explícitas e inferidas
- Histórico agregado de interações
- Entidades relevantes para o usuário
- Atalhos acionáveis baseados em comportamento

Integrações / Dependências diretas:
- tenants
- global_users
- update_updated_at_column()

Integrações indiretas:
- Social Core (029)
- Social Chat Intelligence (031)
- CARE Engine (033)
- Schedule (032)
- Orchestrator / AI Kernel

Decisões de arquitetura:
- Memória é consolidada (não log bruto)
- Scores usam NUMERIC para precisão determinística
- Um registro por conceito, com contadores incrementais
- Totalmente multi-tenant com RLS completa

Observações:
- Seguro para reprocessamento por IA
- Pronto para execução em lote
*/

-- =========================================================
-- USER MEMORY PREFERENCES
-- =========================================================
CREATE TABLE IF NOT EXISTS user_memory_preferences (
  preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,

  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00
    CHECK (confidence >= 0 AND confidence <= 1),

  usage_count INTEGER NOT NULL DEFAULT 1 CHECK (usage_count >= 0),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_memory_preferences_unique
    UNIQUE (tenant_id, global_user_id, category, key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_preferences_user
  ON user_memory_preferences (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_memory_preferences_category
  ON user_memory_preferences (category);

CREATE INDEX IF NOT EXISTS idx_user_memory_preferences_last_used
  ON user_memory_preferences (global_user_id, last_used_at DESC);

-- RLS
ALTER TABLE user_memory_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'user_memory_preferences'
      AND policyname = 'user_memory_preferences_rls'
  ) THEN
    CREATE POLICY user_memory_preferences_rls
      ON user_memory_preferences
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_memory_preferences_updated_at ON user_memory_preferences;
CREATE TRIGGER trg_user_memory_preferences_updated_at
  BEFORE UPDATE ON user_memory_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- USER MEMORY INTERACTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS user_memory_interactions (
  interaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  intent TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,

  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,

  interaction_count INTEGER NOT NULL DEFAULT 1 CHECK (interaction_count >= 0),

  first_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_memory_interactions_unique
    UNIQUE (tenant_id, global_user_id, intent, entity_type, entity_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_user
  ON user_memory_interactions (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_intent
  ON user_memory_interactions (intent);

CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_entity
  ON user_memory_interactions (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_last
  ON user_memory_interactions (global_user_id, last_interaction_at DESC);

-- RLS
ALTER TABLE user_memory_interactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'user_memory_interactions'
      AND policyname = 'user_memory_interactions_rls'
  ) THEN
    CREATE POLICY user_memory_interactions_rls
      ON user_memory_interactions
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_memory_interactions_updated_at ON user_memory_interactions;
CREATE TRIGGER trg_user_memory_interactions_updated_at
  BEFORE UPDATE ON user_memory_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- USER MEMORY ENTITIES
-- =========================================================
CREATE TABLE IF NOT EXISTS user_memory_entities (
  entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,

  target_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL,
  target_company_id UUID,

  entity_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  relevance_score NUMERIC(3,2) NOT NULL DEFAULT 1.00
    CHECK (relevance_score >= 0 AND relevance_score <= 1),

  interaction_count INTEGER NOT NULL DEFAULT 1 CHECK (interaction_count >= 0),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_memory_entities_unique
    UNIQUE (tenant_id, global_user_id, entity_type, entity_name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_entities_user
  ON user_memory_entities (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_memory_entities_type
  ON user_memory_entities (entity_type);

CREATE INDEX IF NOT EXISTS idx_user_memory_entities_target_user
  ON user_memory_entities (target_global_user_id)
  WHERE target_global_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_memory_entities_target_company
  ON user_memory_entities (target_company_id)
  WHERE target_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_memory_entities_relevance
  ON user_memory_entities (global_user_id, relevance_score DESC);

-- RLS
ALTER TABLE user_memory_entities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'user_memory_entities'
      AND policyname = 'user_memory_entities_rls'
  ) THEN
    CREATE POLICY user_memory_entities_rls
      ON user_memory_entities
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_memory_entities_updated_at ON user_memory_entities;
CREATE TRIGGER trg_user_memory_entities_updated_at
  BEFORE UPDATE ON user_memory_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- USER MEMORY SHORTCUTS
-- =========================================================
CREATE TABLE IF NOT EXISTS user_memory_shortcuts (
  shortcut_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  label TEXT NOT NULL,
  intent TEXT NOT NULL,
  parameters JSONB NOT NULL,

  usage_count INTEGER NOT NULL DEFAULT 1 CHECK (usage_count >= 0),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_memory_shortcuts_unique
    UNIQUE (tenant_id, global_user_id, label)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_shortcuts_user
  ON user_memory_shortcuts (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_memory_shortcuts_intent
  ON user_memory_shortcuts (intent);

CREATE INDEX IF NOT EXISTS idx_user_memory_shortcuts_last_used
  ON user_memory_shortcuts (global_user_id, last_used_at DESC);

-- RLS
ALTER TABLE user_memory_shortcuts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'user_memory_shortcuts'
      AND policyname = 'user_memory_shortcuts_rls'
  ) THEN
    CREATE POLICY user_memory_shortcuts_rls
      ON user_memory_shortcuts
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_memory_shortcuts_updated_at ON user_memory_shortcuts;
CREATE TRIGGER trg_user_memory_shortcuts_updated_at
  BEFORE UPDATE ON user_memory_shortcuts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- COMENTÁRIOS
-- =========================================================
COMMENT ON TABLE user_memory_preferences IS
  'Preferências consolidadas do usuário (horários, gostos, estilos)';

COMMENT ON TABLE user_memory_interactions IS
  'Histórico agregado de interações por intent e entidade';

COMMENT ON TABLE user_memory_entities IS
  'Entidades relevantes para o usuário (profissionais, empresas, produtos, rotas)';

COMMENT ON TABLE user_memory_shortcuts IS
  'Atalhos acionáveis sugeridos com base no histórico do usuário';

-- =========================================================
-- FIM DO ARQUIVO 034_memory_engine.sql
-- =========================================================








