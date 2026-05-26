-- ============================================================
-- PE-1: Economic Policy Engine — economic_policy_resolution_logs
-- ============================================================
-- Sessão: 2026-05-26.
--
-- Trilha de auditoria de cada resolução de policy (Clayton K_pe_10).
-- Append-only por design: cada chamada ao resolutor (mesmo as que
-- falham com AMBIGUITY/NOT_FOUND) grava uma row para debugging
-- operacional.
--
-- Não bloqueia o resolver — log é best-effort. Erro de gravação
-- de log NÃO deve travar a transação financeira.
--
-- Reversibilidade: ALTA. Blast: ZERO.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS economic_policy_resolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Policy escolhida (NULL se NOT_FOUND ou AMBIGUITY).
  policy_id UUID REFERENCES economic_policies(id) ON DELETE SET NULL,

  -- Actor consultando (NULL se contexto não tinha actor).
  actor_id UUID REFERENCES actors(id) ON DELETE SET NULL,

  module_context TEXT NOT NULL,

  resolution_status TEXT NOT NULL
    CHECK (resolution_status IN ('resolved', 'ambiguous', 'not_found', 'error')),

  -- Input completo da resolução (debugging).
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Policy escolhida serializada (snapshot — útil se policy for
  -- modificada depois).
  selected_policy_json JSONB,

  -- Splits calculados (snapshot).
  calculated_splits_json JSONB,

  -- Access pass aplicado (se houver).
  access_pass_id UUID REFERENCES actor_access_passes(id) ON DELETE SET NULL,

  -- Código de erro (se status = 'ambiguous' / 'not_found' / 'error').
  error_code TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economic_policy_resolution_logs_tenant_created
  ON economic_policy_resolution_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_economic_policy_resolution_logs_status
  ON economic_policy_resolution_logs(tenant_id, resolution_status, created_at DESC)
  WHERE resolution_status != 'resolved';

ALTER TABLE economic_policy_resolution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_policy_resolution_logs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY economic_policy_resolution_logs_tenant_isolation
    ON economic_policy_resolution_logs
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

COMMENT ON TABLE economic_policy_resolution_logs IS
  'Trilha append-only de cada resolução de policy. Grava input
   completo + policy escolhida + splits calculados + pass aplicado.
   Permite reproduzir a decisão depois mesmo se a policy mudar.';

COMMIT;
