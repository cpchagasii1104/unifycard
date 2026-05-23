BEGIN;

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  follower_actor_id UUID NOT NULL REFERENCES actors(id),
  followed_actor_id UUID NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_follows UNIQUE (tenant_id, follower_actor_id, followed_actor_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(tenant_id, follower_actor_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(tenant_id, followed_actor_id);

COMMIT;
