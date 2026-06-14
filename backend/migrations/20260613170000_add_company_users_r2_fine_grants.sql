-- ============================================================
-- F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION
-- ============================================================
-- DECISION (Clayton/IA Diretora 2026-06-13): a fonte material de permissão fina
-- do R2 mínimo é `company_users.can_*` — NÃO RBAC v1 órfão (organization_members
-- vive só em migrations_archive), NÃO RBAC V2 (ausente/dormente), NÃO requireRole
-- genérico, NUNCA actorId vindo do cliente.
--
-- Esta migration adiciona 4 colunas booleanas de grant fino à MESMA família das
-- colunas can_* existentes (can_manage_company / can_manage_financial /
-- can_view_reports / can_view_consolidated_inventory). Cada coluna habilita uma
-- superfície admin/leitura HOJE quebrada porque dependia do chain legado
-- (businessAuthorizationService → OrganizationAuthorizationHelper.getUserRole →
-- organization_members AUSENTE ⇒ 403 sempre).
--
--   can_view_audit_logs  → modules/business-audit (GET logs imutáveis)
--   can_view_risk        → modules/risk-command-center (GET dashboard/overview/actors)
--   can_manage_risk      → RESERVADO p/ futuras ações de mitigação de risco (sem runtime hoje)
--   can_manage_policy    → modules/policy-engine (reads + mutations create/activate/apply/revoke)
--
-- INVARIANTES DE SEGURANÇA:
--   - NOT NULL DEFAULT FALSE: todo membro existente nasce SEM a permissão.
--     Como o caminho legado já negava (403), nenhum acesso EXISTENTE é ampliado —
--     a permissão só passa a existir quando um admin (canManageCompany) a concede.
--   - SEM backfill: can_manage_company=true / role='owner' continuam a autorizar por
--     fallback documentado no authorizer (canUserPerformCompanyCapability), exatamente
--     como em canViewConsolidatedInventory (DECISION-0116).
--   - NÃO toca bank_*, ledger, payout, reversal, dispute, actor_delegations, RBAC V2.
--   - NÃO altera owner material de nenhum recurso.
--
-- Reversibilidade: ALTA (DROP COLUMN das 4 colunas).
-- Blast: BAIXO (apenas company_users, mesma família can_*).
-- ============================================================

BEGIN;

ALTER TABLE company_users
  ADD COLUMN IF NOT EXISTS can_view_audit_logs BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_risk       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_risk     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_policy   BOOLEAN NOT NULL DEFAULT false;

COMMIT;
