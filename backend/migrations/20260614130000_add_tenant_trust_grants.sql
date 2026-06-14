-- ============================================================
-- F-R2-TRUST-TENANT-GRANTS-R24-UNFREEZE (DECISION-0127)
-- ============================================================
-- Fecha o resíduo `trust` do baseline 0113: substitui o `requireRole(['admin'])` INTERINO (R2.4
-- congelado) por grant material TENANT-LEVEL em tenant_operator_grants. Trust = engine de
-- compliance/risco/anti-fraude TENANT-SCOPED (profiles/events/score do tenant; actorId é alvo/filtro,
-- nunca subject). NÃO toca dinheiro: as referências a "dispute" no trust são apenas TIPOS DE EVENTO de
-- score (dispute_won/opened/lost), não operações de dispute/reversal/Bank.
--
-- Duas capabilities (view vs manage separados):
--   can_view_tenant_trust   → leitura/consulta trust (profiles, events, can-proceed/avaliação).
--   can_manage_tenant_trust → ações administrativas (registrar evento, recalcular score).
--
-- INVARIANTES:
--   - NOT NULL DEFAULT false; SEM backfill permissivo (grants nascem false).
--   - SOMENTE tenant_operator_grants. NÃO toca bank_*, ledger, transactions, payout, reversal, dispute.
--   - NÃO cria permissão financeira (can_execute_*). NÃO cria RBAC V2 / actor_roles / company_roles.
--   - company_users.can_* NUNCA autoriza trust tenant-level (modelos separados).
--
-- Reversibilidade: ALTA (DROP COLUMN). Blast: BAIXO (mesma família can_* da tabela tenant-level).
-- ============================================================

BEGIN;

ALTER TABLE tenant_operator_grants
  ADD COLUMN IF NOT EXISTS can_view_tenant_trust   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_tenant_trust BOOLEAN NOT NULL DEFAULT false;

COMMIT;
