-- ============================================
-- 049_add_metadata_to_transactions.sql
-- Adiciona coluna metadata e status à tabela transactions
-- ============================================

-- Adiciona coluna metadata (JSONB) para armazenar informações adicionais
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Adiciona coluna status para rastrear o estado da transação
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

-- Cria índice GIN para busca eficiente em metadata
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin ON transactions USING GIN (metadata);

-- Índice para busca por módulo no metadata
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_module ON transactions ((metadata->>'module')) WHERE metadata->>'module' IS NOT NULL;

-- Comentários
COMMENT ON COLUMN transactions.metadata IS 'Metadados adicionais da transação (módulo, categoria, etc.)';
COMMENT ON COLUMN transactions.status IS 'Status da transação: pending, completed, failed, cancelled';


