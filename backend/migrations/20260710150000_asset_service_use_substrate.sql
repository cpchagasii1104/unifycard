-- 20260710150000: F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B — SERVICE_USE / USO OPERACIONAL, SUBSTRATO MÍNIMO
-- (implementação do adendo RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO.md, D-A..D-G). Junção N (NÃO 1:1 como
-- sale_terms/rental_terms): asset_id × service_concept_id × operator_actor_id × arrangement_type.
--
-- GO de Clayton (2026-07-10): SÓ substrato mínimo. Terceiro-operador/release (asset:operate, D-D) FICA para
-- a Fatia 4C — NÃO implementado aqui (aplicação recusa operator_actor_id != owner do asset; fail-closed).
-- Viabilidade (4E), arranjos ricos/piso/excedente (4D) e localidade (4F) FORA. Δbank=0. Forward-only, sem
-- backfill (sistema virgem). Enforcement MATERIAL de offer_kind='service' via FK composta a concept_offer_kinds
-- (mesmo padrão de event_orchestration_template_items/event_operational_needs, 20260708360000).
BEGIN;

CREATE TABLE IF NOT EXISTS actor_asset_service_usages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id           UUID NOT NULL REFERENCES actor_assets(id) ON DELETE CASCADE,
  service_concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE RESTRICT,
  -- D-B: fixo 'service' na v1 (enforcement material via FK composta abaixo) — nunca category/texto-livre.
  service_offer_kind TEXT NOT NULL DEFAULT 'service',
  -- D-C: UMA tabela dono/terceiro-operador; subcaso derivável por comparação com actor_assets.owner_actor_id.
  -- Fatia 4B só ATIVA o subcaso dono-operador (validado na aplicação); coluna já pronta pro terceiro (4C).
  operator_actor_id  UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  -- D-F: vocabulário v1 de arranjo operacional (anúncio; NÃO cobrança/ledger/Bank).
  arrangement_type   TEXT NOT NULL,
  -- v1 = active/paused (mesmo padrão de sale/rental; SEM estado de execução).
  status             TEXT NOT NULL DEFAULT 'active',
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_aasu_service_offer_kind CHECK (service_offer_kind IN ('service')),
  CONSTRAINT chk_aasu_arrangement_type CHECK (arrangement_type IN
    ('daily_fee', 'shift_fee', 'fixed_fee', 'commission', 'revenue_share')),
  CONSTRAINT chk_aasu_status CHECK (status IN ('active', 'paused')),
  -- D-A: junção N, mas idempotente por combinação — reativar é UPDATE, não linha nova duplicada.
  CONSTRAINT uq_aasu_asset_service_operator UNIQUE (asset_id, service_concept_id, operator_actor_id),
  -- D-B/invariante 8-9: service_concept_id DEVE ter offer_kind='service' — nunca category/texto-livre.
  CONSTRAINT fk_aasu_service_concept_is_offerable
    FOREIGN KEY (service_concept_id, service_offer_kind) REFERENCES concept_offer_kinds (concept_id, offer_kind)
);

CREATE INDEX IF NOT EXISTS idx_aasu_asset ON actor_asset_service_usages(asset_id);
CREATE INDEX IF NOT EXISTS idx_aasu_operator ON actor_asset_service_usages(operator_actor_id);

-- RLS tenant-owned (ENABLE+FORCE) — policy DERIVADA via actor_assets, sem tenant_id denormalizado (mesmo
-- padrão de actor_asset_sale_terms/actor_asset_rental_terms — sem segunda verdade de tenant).
ALTER TABLE actor_asset_service_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_asset_service_usages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_asset_service_usages_tenant_isolation ON actor_asset_service_usages;
CREATE POLICY actor_asset_service_usages_tenant_isolation ON actor_asset_service_usages
  USING (EXISTS (SELECT 1 FROM actor_assets a WHERE a.id = actor_asset_service_usages.asset_id
                  AND a.tenant_id = current_setting('app.current_tenant', true)::uuid));

COMMIT;
