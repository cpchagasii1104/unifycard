-- ============================================================
-- FASE X — Bloco 1: Economic Identity (SSOT real)
-- ============================================================
-- Tabelas: economic_identities, economic_identity_events
-- FK: actors PK é apenas `id` (0002) — sem UNIQUE(tenant_id,id) → 42830
-- se referenciar (tenant_id,id) em actors. Escopo: tenant + actor separados.
-- ============================================================

-- economic_identities: uma identidade por (tenant_id, actor_id)
CREATE TABLE economic_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'store', 'hub', 'industry', 'service_provider')),
  trust_score_bps INTEGER NOT NULL DEFAULT 0 CHECK (trust_score_bps >= 0 AND trust_score_bps <= 10000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT economic_identities_tenant_actor_unique UNIQUE (tenant_id, actor_id),
  CONSTRAINT economic_identities_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX idx_economic_identities_tenant ON economic_identities(tenant_id);
CREATE INDEX idx_economic_identities_actor ON economic_identities(actor_id);
CREATE INDEX idx_economic_identities_tenant_actor ON economic_identities(tenant_id, actor_id);
CREATE INDEX idx_economic_identities_tenant_id_id ON economic_identities(tenant_id, id);

-- economic_identity_events: eventos que alimentam o score
CREATE TABLE economic_identity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  event_type TEXT NOT NULL,
  value_delta INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT economic_identity_events_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX idx_economic_identity_events_tenant ON economic_identity_events(tenant_id);
CREATE INDEX idx_economic_identity_events_actor ON economic_identity_events(actor_id);
CREATE INDEX idx_economic_identity_events_tenant_actor ON economic_identity_events(tenant_id, actor_id);
CREATE INDEX idx_economic_identity_events_created_at ON economic_identity_events(created_at);
