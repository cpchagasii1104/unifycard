-- ============================================================
-- UNIFICARD — MIGRATION 074
-- Arquivo: 074_event_metrics.sql
-- Tipo: ANALYTICS / OBSERVABILITY (Events)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Eventos exigem métricas de performance para entender:
-- • visualizações
-- • cliques em CTA
-- • conversões
-- • abandono
--
-- Este módulo é usado para:
-- • dashboards
-- • otimização de feed
-- • métricas de conversão
--
-- GOVERNANÇA
-- • event_metrics é APPEND-ONLY
-- • registros NÃO devem ser atualizados nem deletados
-- • deduplicação e rate-limit ocorrem na aplicação
--
-- MODELO DE MÉTRICAS
-- • VIEW
-- • CTA_CLICK
-- • CONVERSION
-- • ABANDONMENT
--
-- OBSERVAÇÕES IMPORTANTES
-- • Métricas podem ser geradas por frontend ou backend
-- • global_user_id é opcional (ex: visitantes anônimos)
-- • metadata é livre para experimentação controlada
--
-- IDEMPOTÊNCIA
-- • Migration é idempotente
-- • Métricas em si NÃO são idempotentes por padrão
--
-- DEPENDÊNCIAS
-- • events
-- • tenants
-- • global_users
--
-- ============================================================


-- ============================================================
-- 1) EVENT METRICS
-- ============================================================

CREATE TABLE IF NOT EXISTS event_metrics (
  metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES events(id) ON DELETE CASCADE,

  global_user_id UUID
    REFERENCES global_users(global_user_id) ON DELETE SET NULL,

  -- Tipo de métrica
  metric_type TEXT NOT NULL,

  -- Contexto opcional
  cta_type TEXT,
  source TEXT,

  -- Deduplicação opcional (controlada pela aplicação)
  deduplication_key VARCHAR(255),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  metadata JSONB DEFAULT '{}'::jsonb
);


-- ============================================================
-- 2) CONSTRAINTS DE DOMÍNIO (EVOLUTIVAS)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_metrics_metric_type_check'
  ) THEN
    ALTER TABLE event_metrics
      ADD CONSTRAINT event_metrics_metric_type_check
      CHECK (
        metric_type IN (
          'VIEW',
          'CTA_CLICK',
          'CONVERSION',
          'ABANDONMENT'
        )
      );
  END IF;
END $$;


-- ============================================================
-- 3) ÍNDICES (FOCO EM CONSULTA REAL)
-- ============================================================

-- Métricas por evento (principal)
CREATE INDEX IF NOT EXISTS idx_event_metrics_event_time
  ON event_metrics (event_id, created_at DESC);

-- Métricas por evento + tipo
CREATE INDEX IF NOT EXISTS idx_event_metrics_event_type
  ON event_metrics (event_id, metric_type, created_at DESC);

-- Métricas por usuário
CREATE INDEX IF NOT EXISTS idx_event_metrics_user_time
  ON event_metrics (global_user_id, created_at DESC)
  WHERE global_user_id IS NOT NULL;

-- Métricas por tenant (analytics globais)
CREATE INDEX IF NOT EXISTS idx_event_metrics_tenant_time
  ON event_metrics (tenant_id, created_at DESC);

-- Deduplicação opcional
CREATE INDEX IF NOT EXISTS idx_event_metrics_deduplication
  ON event_metrics (tenant_id, deduplication_key)
  WHERE deduplication_key IS NOT NULL;


-- ============================================================
-- 4) RLS
-- ============================================================

ALTER TABLE event_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_metrics'
      AND policyname = 'event_metrics_rls'
  ) THEN
    CREATE POLICY event_metrics_rls
      ON event_metrics
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;


-- ============================================================
-- 5) COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE event_metrics IS
  'Métricas append-only de eventos (views, cliques, conversões, abandono)';

COMMENT ON COLUMN event_metrics.metric_type IS
  'Tipo de métrica: VIEW, CTA_CLICK, CONVERSION, ABANDONMENT';

COMMENT ON COLUMN event_metrics.cta_type IS
  'Tipo de CTA associado à métrica (ticket, consumption, parking)';

COMMENT ON COLUMN event_metrics.source IS
  'Origem da interação (feed, event_page, direct)';

COMMENT ON COLUMN event_metrics.deduplication_key IS
  'Chave opcional para deduplicação de métricas em janelas curtas (controlada pela aplicação)';


-- ============================================================
-- FIM 074_event_metrics.sql
-- ============================================================













