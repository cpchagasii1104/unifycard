-- ================================================
-- UNIFICARD - MIGRATION 057
-- Add auto_active status to categories_status_check
-- FASE 3.6: Suporte para status auto_active (criado por IA, visível imediatamente)
-- ================================================

-- Remover constraint antiga
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_status_check'
  ) THEN
    ALTER TABLE categories
    DROP CONSTRAINT categories_status_check;
  END IF;
END $$;

-- Adicionar constraint atualizada com auto_active
ALTER TABLE categories
ADD CONSTRAINT categories_status_check 
CHECK (status IN ('active', 'auto_active', 'pending', 'rejected', 'archived'));

-- Atualizar comentário
COMMENT ON COLUMN categories.status IS 'Status da categoria: active (aprovada manualmente), auto_active (criada por IA, visível imediatamente), pending (aguardando aprovação), rejected (rejeitada), archived (arquivada)';















