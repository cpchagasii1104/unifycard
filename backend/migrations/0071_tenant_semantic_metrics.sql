-- ============================================================
-- 0071: tenant_semantic_metrics
-- ============================================================
-- Agregação diária por tenant a partir de DECISION_STATS (inferência).
-- ============================================================

BEGIN;

CREATE TABLE tenant_semantic_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  date DATE NOT NULL,

  graph_success_count INTEGER NOT NULL DEFAULT 0,
  slug_fallback_count INTEGER NOT NULL DEFAULT 0,
  graph_missing_count INTEGER NOT NULL DEFAULT 0,

  total_requests INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, date)
);

CREATE INDEX idx_tenant_semantic_metrics_tenant_date ON tenant_semantic_metrics (tenant_id, date DESC);

COMMENT ON TABLE tenant_semantic_metrics IS
  'Métricas agregadas por tenant/dia (graph vs slug vs missing); alimentado pelo motor de inferência.';

COMMIT;
