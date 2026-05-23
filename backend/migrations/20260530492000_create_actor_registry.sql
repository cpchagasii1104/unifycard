-- Migration: create actor_registry table

CREATE TABLE IF NOT EXISTS actor_registry (
  registry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, actor_id),
  UNIQUE (tenant_id, entity_table, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_actor_registry_tenant_actor
  ON actor_registry (tenant_id, actor_id);
