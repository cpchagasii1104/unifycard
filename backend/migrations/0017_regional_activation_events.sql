-- ============================================================
-- FASE X — Bloco 2: Regional Activation Events (histórico)
-- ============================================================
-- Tabela: regional_activation_events (getRegionalActivationHistory)
-- ============================================================

BEGIN;

CREATE TABLE regional_activation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('suggest_hub', 'enable_industry_onboarding', 'unlock_incentive')),
  snapshot_id UUID REFERENCES regional_impact_snapshots(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX idx_regional_activation_events_tenant_region ON regional_activation_events(tenant_id, country, state, city);
CREATE INDEX idx_regional_activation_events_tenant_region_action ON regional_activation_events(tenant_id, country, state, city, action_type);
CREATE INDEX idx_regional_activation_events_triggered_at ON regional_activation_events(triggered_at DESC);

COMMIT;
