BEGIN;

CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post','comment','event')),
  entity_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like'
    CHECK (reaction_type IN ('like','love','support','celebrate','insightful')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_reactions UNIQUE (tenant_id, actor_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_entity ON reactions(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reactions_actor ON reactions(tenant_id, actor_id);

COMMIT;
