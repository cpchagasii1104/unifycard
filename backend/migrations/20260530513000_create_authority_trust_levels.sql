-- G2 Transversal E2E exige authority_trust_levels (modo permissivo)
-- Tabela INEXISTENTE = ATL_SCHEMA_REQUIRED_STRICT_MODE (bloqueia em modo strict)
-- Solução: criar tabela (pode ficar vazia para o G2)

CREATE TABLE IF NOT EXISTS authority_trust_levels (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  actor_id     UUID        NOT NULL REFERENCES actors (id) ON DELETE CASCADE,
  atl_level    INTEGER     NOT NULL DEFAULT 1,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT authority_trust_levels_level_check CHECK (atl_level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_authority_trust_levels_actor
  ON authority_trust_levels (tenant_id, actor_id, effective_at DESC);

ALTER TABLE authority_trust_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_trust_levels FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON authority_trust_levels
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON TABLE authority_trust_levels IS
  'Nivel de confianca operacional por actor (ATL). Tabela vazia = trust default.
   atl_level <= 0 bloqueia. atl_level >= 1 permite operacoes financeiras sensiveis.';

COMMIT;
