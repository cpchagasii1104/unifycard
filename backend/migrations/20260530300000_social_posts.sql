BEGIN;

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (post_type IN ('standard','system_auto_post','economic_auto_post',
                         'group_post','user_activity')),
  media_ids UUID[] NOT NULL DEFAULT '{}',
  intent TEXT,
  intent_metadata JSONB,
  targeting JSONB,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_tenant ON posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_posts_actor ON posts(actor_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

COMMIT;
