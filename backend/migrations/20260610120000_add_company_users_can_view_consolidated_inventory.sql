-- ============================================================
-- F-INVENTORY-COMPANY-CONSOLIDATED-AUTHORITY-IMPL (DECISION-0116 adendo)
-- ============================================================
-- Permissão específica de visualização do estoque consolidado da empresa.
-- Decisão Clayton 2026-06-10: membro NÃO precisa virar admin geral para ver
-- o consolidado; a autorização é (can_manage_company OR can_view_consolidated_inventory),
-- sempre exigindo vínculo ATIVO em company_users.
--
-- Regras:
--   - NOT NULL DEFAULT FALSE (membros comuns nascem sem a permissão)
--   - SEM backfill para admins: can_manage_company=true já autoriza o consolidado
--   - NÃO altera owner material do estoque (inventory_movements.actor_id)
--   - NÃO toca actor_delegations (R2 congelado) nem FASE 6
--
-- Reversibilidade: ALTA (drop column)
-- Blast: BAIXO (apenas company_users, mesma família das colunas can_* existentes)
-- ============================================================

BEGIN;

ALTER TABLE company_users
  ADD COLUMN IF NOT EXISTS can_view_consolidated_inventory BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
