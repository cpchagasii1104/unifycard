-- ============================================================
-- F-R2-TENANT-LEVEL-OPERATOR-GRANTS (DECISION-0126)
-- ============================================================
-- Decisão Clayton/IA Diretora 2026-06-14: `company_users.can_*` é permissão POR EMPRESA e NUNCA
-- autoriza leitura tenant-wide (DECISION-0125 §escopo). Para destravar com segurança as superfícies
-- tenant-wide hoje FAIL-CLOSED (reporting, risk overview/list, business-audit sem actor/company scope,
-- policy tenant-wide/list/mutations) cria-se um MODELO MATERIAL SEPARADO de operador tenant-level.
--
-- Tenant-wide só pode abrir por GRANT TENANT-LEVEL EXPLÍCITO nesta tabela. Não há fonte material viva
-- para operador tenant-level hoje (não existe tenant_members/tenant_users/admins); users.tenant_id é o
-- tenant-casa do usuário, NÃO um grant de operação. Esta tabela é a SSOT do grant tenant-level.
--
-- INVARIANTES DE SEGURANÇA:
--   - SUBJECT sempre server-side (users.global_user_id resolvido de req.user). actorId client-declared
--     NUNCA é subject. company_users.can_* NUNCA autoriza tenant-wide (modelos separados).
--   - Grant em tenant A NÃO vale tenant B (chave por tenant_id).
--   - Todos os grants nascem false/inexistentes — SEM backfill permissivo.
--   - SOMENTE capabilities de LEITURA/POLÍTICA não-financeiras. NÃO cria can_execute_payout/
--     can_execute_dispute_action/can_execute_reversal nem qualquer permissão financeira (essas dependem
--     do Core de Aprovação Financeira — fora do escopo).
--   - NÃO toca bank_*, ledger, payout, reversal, dispute, RBAC V2, actor_roles/company_roles.
--
-- global_users PK = global_user_id (SSOT pós-Gate-0). FK referencia global_user_id (NÃO "id").
-- Reversibilidade: ALTA (DROP TABLE). Blast: BAIXO (tabela nova isolada).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_operator_grants (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  global_user_id              UUID NOT NULL REFERENCES global_users (global_user_id) ON DELETE CASCADE,

  can_view_tenant_reports     BOOLEAN NOT NULL DEFAULT false,
  can_view_tenant_audit_logs  BOOLEAN NOT NULL DEFAULT false,
  can_view_tenant_risk        BOOLEAN NOT NULL DEFAULT false,
  can_manage_tenant_policy    BOOLEAN NOT NULL DEFAULT false,

  is_active                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_operator_grants_tenant_user
  ON tenant_operator_grants (tenant_id, global_user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_operator_grants_tenant
  ON tenant_operator_grants (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_operator_grants_global_user
  ON tenant_operator_grants (global_user_id);

COMMIT;
