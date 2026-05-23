-- ============================================================
-- 0070: tenant_semantic_policy
-- ============================================================
-- Sobrescreve política semântica baseada em env por tenant.
-- Sem linha → comportamento continua só com env (via código).
-- ============================================================

BEGIN;

CREATE TABLE tenant_semantic_policy (
  tenant_id UUID PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  allow_slug_fallback BOOLEAN NOT NULL DEFAULT TRUE,
  log_fallback_as_error BOOLEAN NOT NULL DEFAULT FALSE,
  enforce_graph BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE tenant_semantic_policy IS
  'Política semântica por tenant: sobrescreve defaults de ambiente quando há linha.';

COMMIT;
