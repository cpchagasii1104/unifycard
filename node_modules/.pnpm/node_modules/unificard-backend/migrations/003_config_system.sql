-- ============================================
-- 003_config_system.sql (CORRIGIDA)
-- UnifyConfig: tenant_configs + feature_flags
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- TENANT CONFIGS
-- ===========================
CREATE TABLE tenant_configs (
  config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),

  module VARCHAR(100) NOT NULL,
  key VARCHAR(200) NOT NULL,

  value JSONB NOT NULL,
  value_type VARCHAR(20) NOT NULL CHECK (
    value_type IN ('string','number','boolean','json')
  ),

  is_system BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE (tenant_id, module, key)
);

ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_configs_rls ON tenant_configs
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_tenant_configs_tenant_module
  ON tenant_configs(tenant_id, module);

-- ✅ Índice composto para queries mais rápidas
CREATE INDEX idx_tenant_configs_tenant_module_key
  ON tenant_configs(tenant_id, module, key);

-- ===========================
-- FEATURE FLAGS
-- ===========================
CREATE TABLE feature_flags (
  flag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),

  flag_name VARCHAR(200) NOT NULL,
  description TEXT,

  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage INTEGER NOT NULL DEFAULT 100 CHECK (
    rollout_percentage >= 0 AND rollout_percentage <= 100
  ),

  -- Lista de usuários que SEMPRE verão o flag habilitado,
  -- independente do rollout.
  user_whitelist UUID[] DEFAULT '{}',

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE (tenant_id, flag_name)
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_flags_rls ON feature_flags
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_feature_flags_tenant
  ON feature_flags(tenant_id);

CREATE INDEX idx_feature_flags_tenant_flag
  ON feature_flags(tenant_id, flag_name);

-- ===========================
-- ✅ TRIGGERS PARA UPDATED_AT
-- ===========================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para tenant_configs
CREATE TRIGGER update_tenant_configs_updated_at
  BEFORE UPDATE ON tenant_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para feature_flags
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================
-- COMENTÁRIOS
-- ===========================

COMMENT ON TABLE tenant_configs IS 'Configurações dinâmicas por tenant e módulo';
COMMENT ON TABLE feature_flags IS 'Feature flags com rollout gradual e whitelist de usuários';
COMMENT ON FUNCTION update_updated_at_column IS 'Atualiza coluna updated_at automaticamente em UPDATEs';