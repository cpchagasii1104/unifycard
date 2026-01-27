-- ============================================================
-- UNIFICARD - MIGRATION 255
-- Adicionar service_order_id à tabela bank_splits
-- ============================================================
--
-- OBJETIVO:
-- Adicionar referência ao Service Order que originou o split
-- Permite rastreabilidade completa: service_order -> split
--
-- REGRAS:
-- - service_order_id é opcional (splits podem ser criados sem service order)
-- - Referência à service_orders
-- ============================================================

BEGIN;

-- Adicionar coluna service_order_id
ALTER TABLE bank_splits
ADD COLUMN IF NOT EXISTS service_order_id UUID
    REFERENCES service_orders(id) ON DELETE SET NULL;

-- Adicionar índice para busca por service_order_id
CREATE INDEX IF NOT EXISTS idx_bank_splits_service_order_id
    ON bank_splits(tenant_id, service_order_id)
    WHERE service_order_id IS NOT NULL;

-- Adicionar comentário
COMMENT ON COLUMN bank_splits.service_order_id IS 
    'Referência ao Service Order que originou este split (opcional)';

COMMIT;

-- ============================================================
-- FIM 255_add_service_order_id_to_bank_splits.sql
-- ============================================================




