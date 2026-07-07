-- ============================================================
-- 20260707120000: DECISION-0164 — substrato de DEMANDA de serviço (fatia A)
-- ============================================================
-- Pack F-SERVICE-DEMAND-ORCHESTRATION (7 adendos Clayton). Δbank=0: valores são
-- REGISTRO do combinado; mover dinheiro = PORTA-1. RLS ENABLE+FORCE com GUC
-- CANÔNICO app.current_tenant (lição 2026-07-06). Concepts: compõe com existentes
-- (manicure, faxina-residencial, jardinagem) e cria faltantes (D4).
-- ============================================================

BEGIN;
SELECT set_config('app.concept_governance', 'true', true);

-- D4: concepts de trabalho faltantes (N0 governado: servicos | mobilidade-e-logistica)
INSERT INTO concepts (slug, domain)
SELECT v.slug, v.domain FROM (VALUES
  ('garcom',              'servicos'),
  ('pedreiro',            'servicos'),
  ('servente-demolicao',  'servicos'),
  ('encarregado-de-obra', 'servicos'),
  ('seguranca-eventos',   'servicos'),
  ('cozinheiro',          'servicos'),
  ('eletricista',         'servicos'),
  ('encanador',           'servicos'),
  ('motoboy',             'mobilidade-e-logistica')
) AS v(slug, domain)
WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

-- D1: a demanda como objeto econômico de 1ª classe
CREATE TABLE IF NOT EXISTS service_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  concept_id UUID NOT NULL REFERENCES concepts(concept_id),
  title TEXT NOT NULL,
  description TEXT,
  vinculo TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  quantity_filled INT NOT NULL DEFAULT 0 CHECK (quantity_filled >= 0),
  date_start DATE,
  date_end DATE,
  time_start TIME,
  time_end TIME,
  weekdays INT[] DEFAULT NULL,
  radius_km NUMERIC(6,1),
  acceptance_mode TEXT NOT NULL DEFAULT 'com_analise',
  pricing_mode TEXT NOT NULL DEFAULT 'preco_ofertado',
  offered_price_cents BIGINT,
  cancel_notice_hours INT,
  visibility TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'open',
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_service_demands_vinculo CHECK (vinculo IN ('diaria','periodo','recorrente','efetivo')),
  CONSTRAINT chk_service_demands_acceptance_mode CHECK (acceptance_mode IN ('automatico','com_analise')),
  CONSTRAINT chk_service_demands_pricing_mode CHECK (pricing_mode IN ('preco_ofertado','orcamento')),
  CONSTRAINT chk_service_demands_status CHECK (status IN ('open','filled','closed','cancelled')),
  CONSTRAINT chk_service_demands_visibility CHECK (visibility IN ('public','connections')),
  CONSTRAINT chk_service_demands_filled_le_qty CHECK (quantity_filled <= quantity),
  CONSTRAINT chk_service_demands_weekdays CHECK (weekdays IS NULL OR weekdays <@ ARRAY[0,1,2,3,4,5,6])
);
CREATE INDEX IF NOT EXISTS idx_service_demands_tenant_concept_status
  ON service_demands (tenant_id, concept_id, status);
CREATE INDEX IF NOT EXISTS idx_service_demands_tenant_actor
  ON service_demands (tenant_id, actor_id);

-- D3: aceite/candidatura do provider
CREATE TABLE IF NOT EXISTS service_demand_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  demand_id UUID NOT NULL REFERENCES service_demands(id) ON DELETE CASCADE,
  provider_actor_id UUID NOT NULL REFERENCES actors(id),
  status TEXT NOT NULL DEFAULT 'pending',
  quote_cents BIGINT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sd_responses_status CHECK (status IN ('pending','accepted','chosen','rejected','withdrawn')),
  CONSTRAINT uq_sd_responses_demand_provider UNIQUE (demand_id, provider_actor_id)
);
CREATE INDEX IF NOT EXISTS idx_sd_responses_tenant_provider
  ON service_demand_responses (tenant_id, provider_actor_id);

-- RLS (GUC canônico app.current_tenant — auditado por audit-rls-policy-guc-canonical)
ALTER TABLE service_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_demands FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_demands_tenant_isolation ON service_demands;
CREATE POLICY service_demands_tenant_isolation ON service_demands
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE service_demand_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_demand_responses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sd_responses_tenant_isolation ON service_demand_responses;
CREATE POLICY sd_responses_tenant_isolation ON service_demand_responses
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
