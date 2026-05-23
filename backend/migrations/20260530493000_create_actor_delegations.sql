-- Migration: create actor_delegations table

CREATE TABLE IF NOT EXISTS actor_delegations (
  delegation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_actor_id UUID NOT NULL,
  institutional_actor_id UUID NOT NULL,
  scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_transitive BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_actor_delegations_tenant_user
  ON actor_delegations (tenant_id, user_actor_id);
CREATE INDEX IF NOT EXISTS idx_actor_delegations_tenant_institution
  ON actor_delegations (tenant_id, institutional_actor_id);
