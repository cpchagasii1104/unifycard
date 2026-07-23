-- 20260722130000: EVENT-ENGINE-COMPLETION · C1c-a — facet de EQUIPAMENTO próprio da oferta (checklist).
-- Espelha o molde SELADO C1b (service_offering_genre_facets): elo many-to-many oferta↔equipamento. Multi:
-- uma oferta linka N equipamentos. A FK em concepts impede "equipamento solto" (free-text); a GOVERNANÇA
-- (só concepts de equipamento do pool = domain='produtos-e-comercio' ∧ offer_kind='rentable') é validada no
-- WRITER (tagOfferingEquipment → 422 SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED). Aditiva/idempotente/
-- forward-only. Facet de RAIO-X/descoberta — não define identidade nem preço/agenda. Bank-free (Δbank=0).
BEGIN;

CREATE TABLE IF NOT EXISTS service_offering_equipment_facets (
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_offering_id  UUID NOT NULL REFERENCES service_offerings(id) ON DELETE CASCADE,
  equipment_concept_id UUID NOT NULL REFERENCES concepts(concept_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_offering_id, equipment_concept_id)
);

CREATE INDEX IF NOT EXISTS idx_soef_tenant_concept
  ON service_offering_equipment_facets (tenant_id, equipment_concept_id);

COMMENT ON TABLE service_offering_equipment_facets IS
  'C1c-a: elo MUITOS-PARA-MUITOS oferta↔equipamento (concept governado do pool produtos-e-comercio/rentable). '
  'Espelha service_offering_genre_facets (C1b). Governança do pool validada no writer. Facet de raio-x/descoberta.';

COMMIT;
