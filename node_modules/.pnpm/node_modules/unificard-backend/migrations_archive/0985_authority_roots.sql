CREATE TABLE authority_roots (
  actor_id UUID PRIMARY KEY,
  cpf_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);




