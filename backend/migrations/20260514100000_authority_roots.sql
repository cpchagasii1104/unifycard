-- SSOT mínimo de raiz de autoridade (ATL camada 1 em authority-decision.service).
-- Ausência da tabela gerava 42P01 e ruído em runQueryWithTenant antes do catch ATL_SCHEMA_ABSENT.
BEGIN;

CREATE TABLE IF NOT EXISTS authority_roots (
  actor_id UUID PRIMARY KEY,
  cpf_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_authority_roots_cpf_hash UNIQUE (cpf_hash)
);

COMMENT ON TABLE authority_roots IS
  'Raiz de autoridade por actor; linhas ausentes = skip ATL (AUTHORITY_ROOT_NOT_CONFIGURED_FOR_ACTOR).';

COMMIT;
