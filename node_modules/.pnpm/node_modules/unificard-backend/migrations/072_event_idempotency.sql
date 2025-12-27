-- ================================================
-- UNIFICARD - MIGRATION 072
-- Event Idempotency (Hardening)
-- Adiciona idempotency_key para prevenir duplicação
-- ================================================

-- Adicionar coluna idempotency_key em event_tickets
ALTER TABLE event_tickets ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;

-- Adicionar coluna idempotency_key em event_consumptions
ALTER TABLE event_consumptions ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;

-- Unique indexes por tenant (garante idempotência real)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_tickets_idempotency 
  ON event_tickets(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_consumptions_idempotency 
  ON event_consumptions(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Índices para lookup rápido
CREATE INDEX IF NOT EXISTS idx_tickets_idempotency 
  ON event_tickets(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consumptions_idempotency 
  ON event_consumptions(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Comentários
COMMENT ON COLUMN event_tickets.idempotency_key IS 'Chave de idempotência para prevenir duplicação de checkout';
COMMENT ON COLUMN event_consumptions.idempotency_key IS 'Chave de idempotência para prevenir duplicação de checkout';















