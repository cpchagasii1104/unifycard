-- ============================================================
-- UNIFICARD - MIGRATION 225
-- SPRINT 85: PIX INTEGRATION (REAL, SEGURA, CANÔNICA)
-- Tabela: pix_webhook_events
-- ============================================================
--
-- OBJETIVO:
-- Armazenar eventos de webhook PIX (append-only) para auditoria
-- e conciliação.
--
-- REGRAS:
-- - Append-only (nunca deleta)
-- - Raw payload preservado
-- - Idempotência por provider_event_id
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- ENUM: PIX Webhook Event Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_webhook_event_status') THEN
    CREATE TYPE pix_webhook_event_status AS ENUM (
      'RECEIVED',    -- Evento recebido
      'PROCESSED',   -- Evento processado com sucesso
      'FAILED',      -- Evento falhou ao processar
      'DUPLICATE'    -- Evento duplicado (idempotência)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: pix_webhook_events
-- ============================================================
CREATE TABLE IF NOT EXISTS pix_webhook_events (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Provider
    provider VARCHAR(50) NOT NULL, -- MOCK, ASAAS, MERCADOPAGO, etc.
    provider_event_id VARCHAR(255) NOT NULL, -- ID do evento no provider (para idempotência)
    
    -- Vínculo com charge (se encontrado)
    pix_charge_id UUID
        REFERENCES pix_charges(id) ON DELETE SET NULL,
    
    -- Status
    status pix_webhook_event_status NOT NULL DEFAULT 'RECEIVED',
    
    -- Payload raw (preservado para auditoria)
    raw_payload JSONB NOT NULL,
    
    -- Processamento
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT pix_webhook_events_unique_provider_event UNIQUE (tenant_id, provider, provider_event_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_pix_webhook_events_tenant_id
    ON pix_webhook_events(tenant_id);

-- Índice para buscar por provider
CREATE INDEX IF NOT EXISTS idx_pix_webhook_events_provider
    ON pix_webhook_events(tenant_id, provider, received_at DESC);

-- Índice para buscar por pix_charge
CREATE INDEX IF NOT EXISTS idx_pix_webhook_events_charge
    ON pix_webhook_events(tenant_id, pix_charge_id)
    WHERE pix_charge_id IS NOT NULL;

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_pix_webhook_events_status
    ON pix_webhook_events(tenant_id, status, received_at DESC)
    WHERE status IN ('RECEIVED', 'FAILED');

-- Índice para idempotência
CREATE INDEX IF NOT EXISTS idx_pix_webhook_events_provider_event
    ON pix_webhook_events(tenant_id, provider, provider_event_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE pix_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem eventos do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'pix_webhook_events'
      AND policyname = 'pix_webhook_events_tenant_isolation'
  ) THEN
    CREATE POLICY pix_webhook_events_tenant_isolation
      ON pix_webhook_events
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE pix_webhook_events IS 'Eventos de webhook PIX (append-only). Tudo auditável. Idempotência por provider_event_id.';
COMMENT ON COLUMN pix_webhook_events.raw_payload IS 'Payload raw preservado para auditoria e conciliação';
COMMENT ON COLUMN pix_webhook_events.provider_event_id IS 'ID do evento no provider (para idempotência)';





