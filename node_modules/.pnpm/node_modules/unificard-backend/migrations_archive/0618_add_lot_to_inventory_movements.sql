-- ============================================================
-- UNIFICARD - MIGRATION 171
-- SPRINT 37.4: MARKETPLACE CORE - Lote & Validade (Opt-In)
-- Adiciona inventory_lot_id em inventory_movements
-- ============================================================
--
-- OBJETIVO:
-- Adicionar suporte opcional a lote em movimentações de estoque.
-- Movimento pode OU NÃO referenciar lote.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Lote é OPT-IN (não obrigatório)
-- - Movimento pode existir sem lote
-- - Se referenciar lote, deve pertencer à mesma variante
-- - Não altera comportamento de movimentações existentes
-- ============================================================

-- ============================================================
-- ADICIONAR COLUNA: inventory_lot_id
-- ============================================================
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS inventory_lot_id UUID
    REFERENCES inventory_lots(id) ON DELETE SET NULL;

-- ============================================================
-- ÍNDICE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_movements_lot
    ON inventory_movements (tenant_id, inventory_lot_id)
    WHERE inventory_lot_id IS NOT NULL;

-- ============================================================
-- TRIGGER: Valida que lote pertence à mesma variante
-- (Substitui CHECK constraint pois PostgreSQL não suporta subconsultas)
-- ============================================================
CREATE OR REPLACE FUNCTION validate_movement_lot_variant()
RETURNS TRIGGER AS $$
BEGIN
    -- Se não tem lote, não precisa validar
    IF NEW.inventory_lot_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Verificar se o lote pertence à mesma variante
    IF NOT EXISTS (
        SELECT 1 FROM inventory_lots
        WHERE id = NEW.inventory_lot_id
          AND product_variant_id = NEW.product_variant_id
    ) THEN
        RAISE EXCEPTION 'Lote % não pertence à variante %',
            NEW.inventory_lot_id, NEW.product_variant_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_validate_movement_lot_variant'
    ) THEN
        CREATE TRIGGER trigger_validate_movement_lot_variant
            BEFORE INSERT OR UPDATE OF inventory_lot_id ON inventory_movements
            FOR EACH ROW
            EXECUTE FUNCTION validate_movement_lot_variant();
    END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN inventory_movements.inventory_lot_id IS
    'Lote associado à movimentação (opcional). Se informado, deve pertencer à mesma variante.';




