-- ============================================================
-- FASE X — Bloco 3: Plugin Engine (marketplace_plugins)
-- ============================================================

BEGIN;

CREATE TABLE marketplace_plugins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_plugins_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX idx_marketplace_plugins_tenant ON marketplace_plugins(tenant_id);
CREATE INDEX idx_marketplace_plugins_category ON marketplace_plugins(category);
CREATE INDEX idx_marketplace_plugins_status ON marketplace_plugins(status);
CREATE INDEX idx_marketplace_plugins_tenant_category ON marketplace_plugins(tenant_id, category);

CREATE TABLE marketplace_plugin_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plugin_id UUID NOT NULL REFERENCES marketplace_plugins(id),
  hook TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_plugin_executions_tenant_plugin ON marketplace_plugin_executions(tenant_id, plugin_id);
CREATE INDEX idx_marketplace_plugin_executions_hook ON marketplace_plugin_executions(hook);
CREATE INDEX idx_marketplace_plugin_executions_executed_at ON marketplace_plugin_executions(executed_at DESC);

COMMIT;
