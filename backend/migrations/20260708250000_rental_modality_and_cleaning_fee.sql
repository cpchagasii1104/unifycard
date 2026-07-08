-- 20260708250000: MODALIDADE de imóvel + TAXA DE LIMPEZA anunciada (GO Clayton 2026-07-08).
-- Fatia A — property_rental_modality (long_term/seasonal/commercial): decide as unidades de preço da
--   oferta de IMÓVEL. Casa de praia por diária = property + seasonal (NÃO vira space). Só property.
-- Fatia C — cleaning_fee: taxa ANUNCIADA (Δbank=0, nada financeiro executa). Para space e property
--   seasonal principalmente. policy governada; cents BIGINT obrigatório quando separate_required.
-- resource_type continua sendo a modalidade OPERACIONAL; concept_id segue como identidade semântica.
-- Forward-only. Δbank=0.
BEGIN;

ALTER TABLE rentable_resources
  ADD COLUMN IF NOT EXISTS rental_modality TEXT,
  ADD COLUMN IF NOT EXISTS cleaning_fee_policy TEXT,
  ADD COLUMN IF NOT EXISTS cleaning_fee_cents BIGINT;

-- (A) modalidade governada — só valores válidos, e só para property (outros tipos = NULL).
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_rental_modality_value
  CHECK (rental_modality IS NULL OR rental_modality IN ('long_term', 'seasonal', 'commercial'));
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_rental_modality_property_only
  CHECK (resource_type = 'property' OR rental_modality IS NULL);

-- (C) taxa de limpeza — policy governada; cents não-negativo; obrigatório quando separate_required.
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_cleaning_fee_policy_value
  CHECK (cleaning_fee_policy IS NULL OR cleaning_fee_policy IN ('none', 'included', 'separate_required', 'to_be_arranged'));
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_cleaning_fee_cents_nonneg
  CHECK (cleaning_fee_cents IS NULL OR cleaning_fee_cents >= 0);
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_cleaning_fee_required_when_separate
  CHECK (cleaning_fee_policy IS DISTINCT FROM 'separate_required' OR cleaning_fee_cents IS NOT NULL);

COMMIT;
