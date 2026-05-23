-- ============================================================
-- FASE X — Bloco 2: Finalização Regional Fund (executeAllocation)
-- ============================================================
-- Alterar regional_fund_allocations: status, executed_at
-- ============================================================

BEGIN;

ALTER TABLE regional_fund_allocations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

ALTER TABLE regional_fund_allocations
  DROP CONSTRAINT IF EXISTS regional_fund_allocations_status_check;

ALTER TABLE regional_fund_allocations
  ADD CONSTRAINT regional_fund_allocations_status_check
  CHECK (status IN ('pending', 'executed', 'cancelled'));

COMMIT;
