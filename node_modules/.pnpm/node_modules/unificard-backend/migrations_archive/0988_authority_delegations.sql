CREATE TABLE authority_delegations (
  delegator_actor_id UUID NOT NULL,
  delegate_actor_id UUID NOT NULL,
  scope TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (delegator_actor_id, delegate_actor_id, scope)
);




