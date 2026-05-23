BEGIN;

CREATE TABLE IF NOT EXISTS impact_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  actor_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  impact_delta NUMERIC(10,4) NOT NULL DEFAULT 0,
  source_type TEXT,
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impact_ledger_actor ON impact_ledger(tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_impact_ledger_created ON impact_ledger(created_at DESC);

CREATE TABLE IF NOT EXISTS impact_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  actor_type TEXT NOT NULL,
  balance NUMERIC(12,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_impact_balances UNIQUE (tenant_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_impact_balances_actor ON impact_balances(tenant_id, actor_id);

CREATE TABLE IF NOT EXISTS actor_reputation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  actor_type TEXT NOT NULL,
  impact_total NUMERIC(12,4) NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  diversity_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  reputation_level TEXT NOT NULL DEFAULT 'newcomer'
    CHECK (reputation_level IN ('newcomer','member','contributor','leader','champion')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_actor_reputation UNIQUE (tenant_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_actor_reputation_actor ON actor_reputation(tenant_id, actor_id);

CREATE TABLE IF NOT EXISTS post_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  option_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_post_votes UNIQUE (post_id, actor_id)
);

COMMIT;
