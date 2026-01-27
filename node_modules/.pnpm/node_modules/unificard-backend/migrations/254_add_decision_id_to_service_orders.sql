-- ============================================================
-- UNIFICARD - MIGRATION 254
-- Adicionar decision_id à tabela service_orders
-- ============================================================
--
-- OBJETIVO:
-- Adicionar referência à decisão de booking que originou a service order
-- Permite rastreabilidade completa: booking -> decision -> service_order
--
-- REGRAS:
-- - decision_id é opcional (service orders podem ser criadas sem booking)
-- - Referência à service_booking_decisions
-- ============================================================

BEGIN;

-- Adicionar coluna decision_id
ALTER TABLE service_orders
ADD COLUMN IF NOT EXISTS decision_id UUID
    REFERENCES service_booking_decisions(decision_id) ON DELETE SET NULL;

-- Adicionar índice para busca por decision_id
CREATE INDEX IF NOT EXISTS idx_service_orders_decision_id
    ON service_orders(tenant_id, decision_id)
    WHERE decision_id IS NOT NULL;

-- Adicionar comentário
COMMENT ON COLUMN service_orders.decision_id IS 
    'Referência à decisão de booking que originou esta ordem (opcional)';

COMMIT;

-- ============================================================
-- FIM 254_add_decision_id_to_service_orders.sql
-- ============================================================




