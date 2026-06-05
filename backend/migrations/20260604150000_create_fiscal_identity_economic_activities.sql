-- ============================================================
-- F-PJ-CNAE-EVIDENCE-SCHEMA-MIGRATION (DECISION-0103 D2/D3/D4)
-- Substrato fiscal para CNAE/atividade econômica como EVIDÊNCIA cadastral auditável da PJ.
-- ------------------------------------------------------------
-- CNAE é EVIDÊNCIA fiscal, NÃO identidade semântica: não substitui CONCEPT nem o par
-- (primary_company_type_id, primary_concept_id), e NÃO autoriza publicação/domínio por si só
-- (DECISION-0102/0103). A evidência mora na CASA FISCAL (ancorada em fiscal_identities), nunca em
-- `companies` (projeção). Modelo 1:N (1 principal + N secundários). source/fetched_at obrigatórios.
-- NÃO guarda QSA/sócios/dados pessoais (LGPD, D5). Esta migration instala a tomada fiscal; NÃO há
-- writer (D14) — a persistência (do fetchCNPJFromRevenue já existente, fail-open) é frente própria.
-- Forward-only / transacional / idempotente. NÃO toca companies/fiscal_identities/Bank/marketplace.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS fiscal_identity_economic_activities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_identity_id  UUID NOT NULL REFERENCES fiscal_identities(fiscal_identity_id) ON DELETE CASCADE,
  cnae_code           TEXT NOT NULL,
  cnae_description    TEXT NOT NULL,
  is_primary          BOOLEAN NOT NULL DEFAULT false,
  source              TEXT NOT NULL,
  fetched_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_fiea_cnae_code        CHECK (length(btrim(cnae_code)) > 0),
  CONSTRAINT chk_fiea_cnae_description CHECK (length(btrim(cnae_description)) > 0),
  CONSTRAINT chk_fiea_source           CHECK (length(btrim(source)) > 0),

  -- D3: sem duplicidade do mesmo CNAE na mesma identidade fiscal.
  CONSTRAINT uq_fiea_fiscal_cnae UNIQUE (fiscal_identity_id, cnae_code)
);

-- D4: no máximo UM CNAE principal por identidade fiscal (zero ou um; N secundários livres).
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiea_one_primary
  ON fiscal_identity_economic_activities (fiscal_identity_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_fiea_fiscal_identity
  ON fiscal_identity_economic_activities (fiscal_identity_id);

CREATE INDEX IF NOT EXISTS idx_fiea_cnae_code
  ON fiscal_identity_economic_activities (cnae_code);

COMMENT ON TABLE fiscal_identity_economic_activities IS
  'Evidência fiscal de CNAE/atividade econômica da PJ (DECISION-0103). EVIDÊNCIA, não identidade: não '
  'substitui CONCEPT/par (primary_company_type_id, primary_concept_id) e não autoriza publicação/domínio. '
  'Ancorada na casa fiscal (fiscal_identity_id), 1:N (1 principal + N secundários). NÃO guarda QSA/dados '
  'pessoais (LGPD). source/fetched_at obrigatórios. Sem writer nesta fatia.';
COMMENT ON COLUMN fiscal_identity_economic_activities.is_primary IS
  'CNAE principal (no máx. 1 por fiscal_identity, via uq_fiea_one_primary). Demais = secundários.';
COMMENT ON COLUMN fiscal_identity_economic_activities.source IS
  'Provider da evidência (ex.: receitaws, brasilapi). Obrigatório (DECISION-0103 D7).';
COMMENT ON COLUMN fiscal_identity_economic_activities.fetched_at IS
  'Quando a evidência foi obtida do provider fiscal. Obrigatório (DECISION-0103 D7).';

COMMIT;
