-- Migration: substitui stub fail-open por fail-closed
-- Remediação: C47 (DECISION-0013)
-- Ref: AUTHORITY_PRECEDENCE.md §4.4 — IA não cria autoridade; ausência de política = bloqueio
-- Rollback: re-aplicar 20260421010000_actor_has_permission_stub.sql

BEGIN;

CREATE OR REPLACE FUNCTION actor_has_permission(
  p_tenant_id UUID,
  p_actor_id UUID,
  p_resource TEXT,
  p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- FAIL-CLOSED: sem implementação real de permissões, nenhuma permissão é concedida.
  -- AUTHORITY_PRECEDENCE.md §4.4: "IA nunca pode aliviar restrição superior."
  -- FASE 6 substituirá esta função pela implementação real (RBAC + policy engine).
  -- Até lá, callers que dependem desta função devem:
  --   (a) usar requireFinancialRiskClearance (risk-financial-gate) ou
  --   (b) estabelecer gate próprio documentado
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION actor_has_permission IS
  'Stub fail-closed (C47). Retorna FALSE até FASE 6. Ver DECISION-0013.';

COMMIT;
