CREATE TABLE economic_guardianship (
  subject_actor_id UUID PRIMARY KEY,
  guardian_actor_id UUID NOT NULL,
  scope TEXT NOT NULL,
  limit_amount NUMERIC NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);




