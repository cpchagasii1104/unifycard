-- ============================================================
-- GENESIS 0002: IDENTITY
-- ============================================================
-- SSOT: actors (actor_id)
-- MODO: Constitucional Rígido

BEGIN;

-- Tenants (multi-tenancy)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Actors (SSOT de identidade econômica)
CREATE TABLE actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('person', 'company', 'system')),
  external_id TEXT,
  display_name TEXT NOT NULL,
  cpf_cnpj TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  kyc_verified_at TIMESTAMPTZ,
  kyc_limit_cents BIGINT DEFAULT 500000, -- 5000 BRL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, external_id)
);

CREATE INDEX idx_actors_tenant ON actors(tenant_id);
CREATE INDEX idx_actors_cpf_cnpj ON actors(cpf_cnpj);

-- ATL (Anti-Terrorism/Laundering)
CREATE TABLE atl_blocked_actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL UNIQUE REFERENCES actors(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_reason TEXT NOT NULL,
  blocked_by UUID
);

CREATE INDEX idx_atl_blocked_actor ON atl_blocked_actors(actor_id);

COMMIT;

