/*
Arquivo: 314_event_idempotency_tracking.sql
Projeto: Unificard
Banco: PostgreSQL 14+
Escopo: Idempotency Tracking para Eventos Críticos

Objetivo:
- Criar tabela para rastrear processamento de eventos críticos
- Garantir idempotência em handlers que movem dinheiro, alteram reputação, criam entidades
- Prevenir replay attacks

Dependências:
- Migration 090 (event_log)

Status: CORE
Governing Contract: SYSTEM-CANONICAL-INVARIANTS.md
*/

-- ============================================================
-- 1. TABELA DE IDEMPOTENCY TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS event_idempotency_tracking (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  handler_name VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(512) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  result_status VARCHAR(50) NOT NULL, -- 'success', 'error', 'skipped'
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraint única: mesmo evento não pode ser processado duas vezes pelo mesmo handler
  CONSTRAINT event_idempotency_tracking_unique 
    UNIQUE (tenant_id, event_id, handler_name)
);

-- Índice para queries rápidas por event_id
CREATE INDEX IF NOT EXISTS idx_event_idempotency_event_id 
  ON event_idempotency_tracking(event_id);

-- Índice para queries por tenant_id + event_id
CREATE INDEX IF NOT EXISTS idx_event_idempotency_tenant_event 
  ON event_idempotency_tracking(tenant_id, event_id);

-- Índice para queries por idempotency_key (para verificação de replay)
CREATE INDEX IF NOT EXISTS idx_event_idempotency_key 
  ON event_idempotency_tracking(idempotency_key);

-- Comentários
COMMENT ON TABLE event_idempotency_tracking IS 
  'Rastreia processamento de eventos críticos para garantir idempotência e prevenir replay attacks';

COMMENT ON COLUMN event_idempotency_tracking.idempotency_key IS 
  'Chave única que identifica a operação. Formato: {eventId}:{handlerName}:{payloadHash}';

COMMENT ON COLUMN event_idempotency_tracking.result_status IS 
  'Status do processamento: success, error, skipped (replay detectado)';

-- ============================================================
-- 2. RLS (Row Level Security)
-- ============================================================

ALTER TABLE event_idempotency_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_idempotency_tracking_rls ON event_idempotency_tracking
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- 3. FUNÇÃO HELPER PARA GERAR IDEMPOTENCY KEY
-- ============================================================

CREATE OR REPLACE FUNCTION generate_event_idempotency_key(
  p_event_id UUID,
  p_handler_name VARCHAR,
  p_payload JSONB
) RETURNS VARCHAR AS $$
BEGIN
  -- Gerar hash do payload para detectar mudanças
  RETURN p_event_id::text || ':' || p_handler_name || ':' || 
         encode(digest(p_payload::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_event_idempotency_key IS 
  'Gera chave de idempotência única para evento + handler + payload';



