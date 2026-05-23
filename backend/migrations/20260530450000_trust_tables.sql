BEGIN;

CREATE TABLE IF NOT EXISTS trust_profiles (
  profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  current_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high','critical')),
  total_events INTEGER NOT NULL DEFAULT 0,
  positive_events INTEGER NOT NULL DEFAULT 0,
  negative_events INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_trust_profiles_actor UNIQUE (tenant_id, actor_id)
);
CREATE INDEX IF NOT EXISTS idx_trust_profiles_actor ON trust_profiles(actor_id);
CREATE INDEX IF NOT EXISTS idx_trust_profiles_risk ON trust_profiles(risk_level);

CREATE TABLE IF NOT EXISTS trust_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low'
    CHECK (severity IN ('low','medium','high','critical')),
  score_impact NUMERIC(5,2) NOT NULL DEFAULT 0,
  context_type TEXT,
  context_id UUID,
  evidence_pack_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trust_events_actor ON trust_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_trust_events_context ON trust_events(context_type, context_id);

CREATE TABLE IF NOT EXISTS trust_score_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  score NUMERIC(5,2) NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high','critical')),
  triggered_by_event_id UUID REFERENCES trust_events(event_id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trust_snapshots_actor ON trust_score_snapshots(actor_id);

COMMIT;