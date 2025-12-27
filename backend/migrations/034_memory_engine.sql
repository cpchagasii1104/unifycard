-- ================================================
-- UNIFICARD - MIGRATION 034
-- Memory Engine Module
-- Memória universal do assistente (preferências, hábitos, histórico)
-- ================================================

-- ===========================
-- USER MEMORY PREFERENCES
-- ===========================
CREATE TABLE IF NOT EXISTS user_memory_preferences (
  preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'schedule', 'food', 'transport', 'shopping', 'events', 'services', etc.
  key TEXT NOT NULL, -- 'preferred_time', 'favorite_cuisine', 'usual_route', etc.
  value JSONB NOT NULL, -- Valor da preferência (pode ser string, number, array, object)
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INT DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, global_user_id, category, key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_preferences_user ON user_memory_preferences (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_preferences_category ON user_memory_preferences (category);
CREATE INDEX IF NOT EXISTS idx_user_memory_preferences_last_used ON user_memory_preferences (global_user_id, last_used_at DESC);

-- RLS
ALTER TABLE user_memory_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_memory_preferences_rls ON user_memory_preferences
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- USER MEMORY INTERACTIONS
-- ===========================
CREATE TABLE IF NOT EXISTS user_memory_interactions (
  interaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  intent TEXT NOT NULL, -- 'schedule_service', 'buy_product', 'order_food', etc.
  entity_type TEXT NOT NULL, -- 'worker', 'company', 'product', 'restaurant', 'event', etc.
  entity_id UUID,
  entity_name TEXT,
  parameters JSONB DEFAULT '{}'::jsonb,
  interaction_count INT DEFAULT 1,
  first_interaction_at TIMESTAMPTZ DEFAULT now(),
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_user ON user_memory_interactions (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_intent ON user_memory_interactions (intent);
CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_entity ON user_memory_interactions (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_interactions_last ON user_memory_interactions (global_user_id, last_interaction_at DESC);

-- RLS
ALTER TABLE user_memory_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_memory_interactions_rls ON user_memory_interactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- USER MEMORY ENTITIES
-- ===========================
CREATE TABLE IF NOT EXISTS user_memory_entities (
  entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'worker', 'company', 'restaurant', 'product', 'event', 'route', etc.
  target_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL,
  target_company_id UUID,
  entity_name TEXT NOT NULL,
  entity_metadata JSONB DEFAULT '{}'::jsonb,
  relevance_score FLOAT DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  interaction_count INT DEFAULT 1,
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_entities_user ON user_memory_entities (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_entities_type ON user_memory_entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_entities_target_user ON user_memory_entities (target_global_user_id) WHERE target_global_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_memory_entities_target_company ON user_memory_entities (target_company_id) WHERE target_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_memory_entities_relevance ON user_memory_entities (global_user_id, relevance_score DESC);

-- RLS
ALTER TABLE user_memory_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_memory_entities_rls ON user_memory_entities
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- USER MEMORY SHORTCUTS
-- ===========================
CREATE TABLE IF NOT EXISTS user_memory_shortcuts (
  shortcut_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- 'Agendar com João', 'Pedir x-salada', 'Chamar carro para casa', etc.
  intent TEXT NOT NULL,
  parameters JSONB NOT NULL,
  usage_count INT DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_memory_shortcuts_user ON user_memory_shortcuts (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_shortcuts_intent ON user_memory_shortcuts (intent);
CREATE INDEX IF NOT EXISTS idx_user_memory_shortcuts_last_used ON user_memory_shortcuts (global_user_id, last_used_at DESC);

-- RLS
ALTER TABLE user_memory_shortcuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_memory_shortcuts_rls ON user_memory_shortcuts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Triggers para atualizar updated_at
CREATE OR REPLACE FUNCTION update_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_memory_preferences_updated_at
  BEFORE UPDATE ON user_memory_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_updated_at();

CREATE TRIGGER trigger_update_user_memory_interactions_updated_at
  BEFORE UPDATE ON user_memory_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_updated_at();

CREATE TRIGGER trigger_update_user_memory_entities_updated_at
  BEFORE UPDATE ON user_memory_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_updated_at();

CREATE TRIGGER trigger_update_user_memory_shortcuts_updated_at
  BEFORE UPDATE ON user_memory_shortcuts
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE user_memory_preferences IS 'Preferências do usuário (horários, gostos, estilos)';
COMMENT ON TABLE user_memory_interactions IS 'Histórico de interações do usuário com intents e entidades';
COMMENT ON TABLE user_memory_entities IS 'Entidades relevantes para o usuário (profissionais, empresas, rotas)';
COMMENT ON TABLE user_memory_shortcuts IS 'Ações rápidas sugeridas baseadas no histórico do usuário';








