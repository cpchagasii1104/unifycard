-- ============================================================
-- FASE X — Bloco 2: Regional Impact Snapshots
-- ============================================================
-- Tabela: regional_impact_snapshots (base para regras e incentivos)
-- Período mensal: YYYY-MM (text)
-- ============================================================

BEGIN;

CREATE TABLE regional_impact_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  total_volume_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_volume_cents >= 0),
  total_transactions INTEGER NOT NULL DEFAULT 0 CHECK (total_transactions >= 0),
  regional_fund_inflow_cents BIGINT NOT NULL DEFAULT 0 CHECK (regional_fund_inflow_cents >= 0),
  regional_fund_outflow_cents BIGINT NOT NULL DEFAULT 0 CHECK (regional_fund_outflow_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regional_impact_snapshots_tenant_region_period_unique UNIQUE (tenant_id, country, state, city, period),
  CONSTRAINT regional_impact_snapshots_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX idx_regional_impact_snapshots_tenant ON regional_impact_snapshots(tenant_id);
CREATE INDEX idx_regional_impact_snapshots_region ON regional_impact_snapshots(country, state, city);
CREATE INDEX idx_regional_impact_snapshots_tenant_region ON regional_impact_snapshots(tenant_id, country, state, city);
CREATE INDEX idx_regional_impact_snapshots_period ON regional_impact_snapshots(period DESC);
CREATE INDEX idx_regional_impact_snapshots_tenant_region_period ON regional_impact_snapshots(tenant_id, country, state, city, period DESC);

COMMIT;
