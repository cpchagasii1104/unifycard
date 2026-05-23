-- ============================================================
-- 0072: tenant_concept_offerings
-- ============================================================
-- Liga tenant (negócio) a concept_id: quem oferece o quê no marketplace.
-- ============================================================

BEGIN;

CREATE TABLE tenant_concept_offerings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES concepts (concept_id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, concept_id)
);

CREATE INDEX idx_tenant_concept_offerings_concept ON tenant_concept_offerings (concept_id) WHERE active = TRUE;
CREATE INDEX idx_tenant_concept_offerings_tenant ON tenant_concept_offerings (tenant_id);

COMMENT ON TABLE tenant_concept_offerings IS
  'Mapping tenant → concept: ofertas semânticas para discovery contextual (marketplace).';

COMMIT;
