-- ============================================================
-- FASE X — Bloco 2: Regional Activation Rules
-- ============================================================
-- Tabela: regional_activation_rules (suporta suggest_hub, enable_industry_onboarding, unlock_incentive)
-- ============================================================

BEGIN;

CREATE TABLE regional_activation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('suggest_hub', 'enable_industry_onboarding', 'unlock_incentive')),
  threshold_volume_cents BIGINT,
  threshold_transactions INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regional_activation_rules_tenant_region_action_unique UNIQUE (tenant_id, country, state, city, action_type),
  CONSTRAINT regional_activation_rules_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX idx_regional_activation_rules_tenant ON regional_activation_rules(tenant_id);
CREATE INDEX idx_regional_activation_rules_region ON regional_activation_rules(country, state, city);
CREATE INDEX idx_regional_activation_rules_tenant_region ON regional_activation_rules(tenant_id, country, state, city);
CREATE INDEX idx_regional_activation_rules_action ON regional_activation_rules(action_type);
CREATE INDEX idx_regional_activation_rules_tenant_id_id ON regional_activation_rules(tenant_id, id);

COMMIT;
