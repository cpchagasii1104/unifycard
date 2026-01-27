-- ============================================================
-- UNIFICARD - MIGRATION 095
-- Events Split Processed (Contrato v1.3)
-- ============================================================
--
-- OBJETIVO:
-- Marcar eventos cujo split pós-evento já foi processado
-- pelo backend/scheduler, evitando reprocessamento.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena flags e timestamps de processamento
--   • NÃO executa split
--   • NÃO movimenta dinheiro
-- - A APLICAÇÃO / SCHEDULER:
--   • identifica eventos elegíveis (datetime_end)
--   • executa split via Escrow + SplitEngine
--   • marca split_processed = true
--
-- DECISÕES IMPORTANTES:
-- - split_processed é NOT NULL para evitar estado ambíguo
-- - split_processed_at é informativo/auditável
-- - Este campo é um CHECKPOINT, não um workflow
--
-- DEPENDÊNCIAS:
-- - events (tabela canônica)
--
-- IMPACTO:
-- - Alteração simples e segura
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- CAMPOS DE CONTROLE DE SPLIT
-- ============================================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS split_processed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_processed_at TIMESTAMPTZ;


-- ============================================================
-- ÍNDICE PARA SCHEDULER
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_split_processed
  ON events (tenant_id, split_processed, datetime_end);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN events.split_processed IS
  'Indica se o split pós-evento já foi processado pelo backend.';

COMMENT ON COLUMN events.split_processed_at IS
  'Data/hora em que o split pós-evento foi processado.';













