-- ================================================
-- UNIFICARD - MIGRATION 074
-- Event Metrics (FASE 5A)
-- Sistema de métricas para eventos (views, clicks, conversions)
-- ================================================

-- ===========================
-- EVENT METRICS
-- ===========================
CREATE TABLE IF NOT EXISTS event_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL,
  
  -- Tipo de métrica
  metric_type TEXT NOT NULL CHECK (metric_type IN ('VIEW', 'CTA_CLICK', 'CONVERSION', 'ABANDONMENT')),
  
  -- Contexto
  cta_type TEXT, -- 'ticket', 'consumption', 'parking' (para CTA_CLICK)
  source TEXT, -- 'feed', 'event_page', 'direct' (para VIEW)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata adicional (JSON)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_metrics_event ON event_metrics (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_metrics_user ON event_metrics (global_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_metrics_type ON event_metrics (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_metrics_tenant ON event_metrics (tenant_id, created_at DESC);

-- RLS
ALTER TABLE event_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_metrics_rls ON event_metrics
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Comentários
COMMENT ON TABLE event_metrics IS 'Métricas de eventos (visualizações, cliques em CTA, conversões)';
COMMENT ON COLUMN event_metrics.metric_type IS 'Tipo: VIEW, CTA_CLICK, CONVERSION, ABANDONMENT';
COMMENT ON COLUMN event_metrics.cta_type IS 'Tipo de CTA clicado (ticket, consumption, parking)';
COMMENT ON COLUMN event_metrics.source IS 'Origem da visualização (feed, event_page, direct)';













