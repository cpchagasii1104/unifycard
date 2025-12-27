-- ================================================
-- UNIFICARD - MIGRATION 071
-- Event Consumption Status
-- Adicionar coluna status à tabela event_consumptions
-- ================================================

-- Adicionar coluna status com default ACTIVE (para registros existentes)
ALTER TABLE event_consumptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Adicionar constraint CHECK para status
ALTER TABLE event_consumptions DROP CONSTRAINT IF EXISTS check_consumption_status;
ALTER TABLE event_consumptions ADD CONSTRAINT check_consumption_status 
  CHECK (status IN ('PENDING', 'ACTIVE', 'CANCELLED'));

-- Índice para queries por status
CREATE INDEX IF NOT EXISTS idx_consumptions_status ON event_consumptions(status) WHERE status = 'PENDING';















