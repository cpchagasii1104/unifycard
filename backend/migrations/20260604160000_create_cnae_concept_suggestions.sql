-- ============================================================
-- F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-SCHEMA-MIGRATION (DECISION-0104)
-- Quadro (matriz) GOVERNADO de SUGESTÃO CNAE → CONCEPT. Cria o quadro; NÃO escreve sugestão nele.
-- ------------------------------------------------------------
-- CNAE é SINAL/EVIDÊNCIA, NÃO autoridade (D1): esta tabela SUGERE candidatos de identidade semântica,
-- mas NÃO ativa empresa, NÃO escolhe o concept final, NÃO escreve companies.primary_company_type_id/
-- primary_concept_id, NÃO publica (company_concept_publications/tenant_concept_offerings), NÃO mapeia
-- MarketplaceDomain nem deriva domínios elegíveis (D3/D12/D16). CONCEPT permanece a identidade semântica
-- soberana (D2); company_type é derivado via company_type_allowed_concepts (D4 — NÃO mora aqui).
-- Multi-candidato por CNAE (D5); confidence (D6); rationale/source/catalog_version (D7); review_status (D8).
-- SEM seed/writer/endpoint/frontend nesta migration — o seed é FUTURO e SELETIVO (D9: só as 7 verticais;
-- proibido importar o CNAE oficial inteiro). Forward-only / transacional / idempotente. NÃO toca
-- companies/fiscal_identities/Bank/marketplace.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cnae_concept_suggestions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnae_code             TEXT NOT NULL,
  suggested_concept_id  UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
  confidence            TEXT NOT NULL,
  rationale             TEXT NOT NULL,
  source                TEXT NOT NULL,
  catalog_version       TEXT NOT NULL,
  review_status         TEXT NOT NULL DEFAULT 'proposed',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_ccs_cnae_code        CHECK (length(btrim(cnae_code)) > 0),
  CONSTRAINT chk_ccs_rationale        CHECK (length(btrim(rationale)) > 0),
  CONSTRAINT chk_ccs_source           CHECK (length(btrim(source)) > 0),
  CONSTRAINT chk_ccs_catalog_version  CHECK (length(btrim(catalog_version)) > 0),
  -- D6: confiança/prioridade (principal pesa mais que secundário — política no consumidor futuro).
  CONSTRAINT chk_ccs_confidence       CHECK (confidence IN ('low','medium','high')),
  -- D8: curadoria humana (mapping não revisado não vira sugestão forte).
  CONSTRAINT chk_ccs_review_status    CHECK (review_status IN ('proposed','approved','retired')),

  -- D5: N candidatos por CNAE, mas sem duplicar o mesmo par (cnae, concept).
  CONSTRAINT uq_ccs_cnae_concept UNIQUE (cnae_code, suggested_concept_id)
);

CREATE INDEX IF NOT EXISTS idx_cnae_concept_suggestions_cnae_code
  ON cnae_concept_suggestions (cnae_code);

CREATE INDEX IF NOT EXISTS idx_cnae_concept_suggestions_concept
  ON cnae_concept_suggestions (suggested_concept_id);

-- Lookup do caminho quente: sugestões vivas e revisadas para um CNAE.
CREATE INDEX IF NOT EXISTS idx_ccs_active_approved
  ON cnae_concept_suggestions (cnae_code)
  WHERE is_active = true AND review_status = 'approved';

COMMENT ON TABLE cnae_concept_suggestions IS
  'Matriz GOVERNADA de SUGESTÃO CNAE → CONCEPT (DECISION-0104). CNAE é SINAL/EVIDÊNCIA, não autoridade: '
  'SUGERE candidatos de concept, NÃO ativa empresa, NÃO escolhe o concept final, NÃO escreve companies.primary_*, '
  'NÃO publica (company_concept_publications/tenant_concept_offerings), NÃO mapeia MarketplaceDomain, NÃO deriva '
  'domínios elegíveis. CONCEPT permanece a identidade semântica soberana; company_type é derivado via '
  'company_type_allowed_concepts (não mora aqui). Multi-candidato por CNAE. Seed é FUTURO e SELETIVO (só as 7 '
  'verticais; proibido importar o CNAE oficial inteiro). Sugestão entra no fluxo como pending; aplicar exige ato explícito.';
COMMENT ON COLUMN cnae_concept_suggestions.suggested_concept_id IS
  'CONCEPT sugerido (FK concepts). É SUGESTÃO, nunca o par soberano (primary_company_type_id, primary_concept_id).';
COMMENT ON COLUMN cnae_concept_suggestions.confidence IS
  'Confiança/prioridade da sugestão (low|medium|high). CNAE principal deve pesar mais que secundário (D6).';
COMMENT ON COLUMN cnae_concept_suggestions.review_status IS
  'Curadoria humana (proposed|approved|retired). Mapping não revisado não deve virar sugestão forte (D8).';
COMMENT ON COLUMN cnae_concept_suggestions.catalog_version IS
  'Versão/revisão do catálogo de mapping (auditabilidade — D7).';

COMMIT;
