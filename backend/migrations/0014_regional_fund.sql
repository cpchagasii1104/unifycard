-- ============================================================
-- FASE X — Bloco 2: Regional Fund (operacional)
-- ============================================================
-- Tabelas: regional_funds, regional_fund_allocations
-- FK fundo: (tenant_id, regional_fund_id) → regional_funds(tenant_id, id) OK (UNIQUE em regional_funds).
-- FK actor: actors só tem PK em id — usar actor_id → actors(id); tenant já em tenants(id).
-- ============================================================

-- regional_funds: um fundo por (tenant_id, country, state, city)
CREATE TABLE regional_funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  total_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_balance_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regional_funds_tenant_region_unique UNIQUE (tenant_id, country, state, city),
  CONSTRAINT regional_funds_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX idx_regional_funds_tenant ON regional_funds(tenant_id);
CREATE INDEX idx_regional_funds_region ON regional_funds(country, state, city);
CREATE INDEX idx_regional_funds_tenant_region ON regional_funds(tenant_id, country, state, city);
CREATE INDEX idx_regional_funds_tenant_id_id ON regional_funds(tenant_id, id);

-- regional_fund_allocations: alocações (débito do fundo)
CREATE TABLE regional_fund_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  regional_fund_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES actors(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  allocation_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_regional_fund_allocations_fund
    FOREIGN KEY (tenant_id, regional_fund_id)
    REFERENCES regional_funds(tenant_id, id),
  CONSTRAINT regional_fund_allocations_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX idx_regional_fund_allocations_tenant ON regional_fund_allocations(tenant_id);
CREATE INDEX idx_regional_fund_allocations_fund ON regional_fund_allocations(regional_fund_id);
CREATE INDEX idx_regional_fund_allocations_actor ON regional_fund_allocations(actor_id);
CREATE INDEX idx_regional_fund_allocations_tenant_fund ON regional_fund_allocations(tenant_id, regional_fund_id);
CREATE INDEX idx_regional_fund_allocations_tenant_id_id ON regional_fund_allocations(tenant_id, id);
