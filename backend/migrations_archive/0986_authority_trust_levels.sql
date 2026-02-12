CREATE TABLE authority_trust_levels (
  actor_id UUID PRIMARY KEY,
  atl_level INTEGER NOT NULL,
  reason TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ
);




