BEGIN;

CREATE TABLE IF NOT EXISTS group_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  bank_account_id UUID REFERENCES bank_accounts(id),
  balance_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_account UNIQUE (tenant_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_group_accounts_group ON group_accounts(group_id);

CREATE TABLE IF NOT EXISTS group_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  invited_actor_id UUID NOT NULL REFERENCES actors(id),
  invited_by_actor_id UUID NOT NULL REFERENCES actors(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_invite UNIQUE (group_id, invited_actor_id)
);
CREATE INDEX IF NOT EXISTS idx_group_invites_group ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_actor ON group_invites(invited_actor_id);

CREATE TABLE IF NOT EXISTS group_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  created_by_actor_id UUID NOT NULL REFERENCES actors(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed','cancelled')),
  closes_at TIMESTAMPTZ,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_votes_group ON group_votes(group_id);

CREATE TABLE IF NOT EXISTS group_vote_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  vote_id UUID NOT NULL REFERENCES group_votes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_vote_options_vote ON group_vote_options(vote_id);

CREATE TABLE IF NOT EXISTS group_vote_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  vote_id UUID NOT NULL REFERENCES group_votes(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES group_vote_options(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_vote_response UNIQUE (vote_id, actor_id)
);
CREATE INDEX IF NOT EXISTS idx_group_vote_responses_vote ON group_vote_responses(vote_id);

COMMIT;
