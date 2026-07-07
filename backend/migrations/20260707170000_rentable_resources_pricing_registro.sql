-- 20260707170000: DECISION-0151 ADENDO A — preço-anúncio + unidade de cobrança (REGISTRO PURO).
-- Δbank=0: colunas de ANÚNCIO; nunca alimentam saldo/split/decisão financeira (LEI §4.6).
-- Execução de pagamento de locação segue PORTA-1/HOLD. Precedente: service_demands.offered_price_cents.
BEGIN;
ALTER TABLE rentable_resources
  ADD COLUMN IF NOT EXISTS pricing_unit TEXT NULL
    CHECK (pricing_unit IS NULL OR pricing_unit IN ('por_hora','por_dia','por_semana','por_mes')),
  ADD COLUMN IF NOT EXISTS price_cents BIGINT NULL CHECK (price_cents IS NULL OR price_cents >= 0);
COMMENT ON COLUMN rentable_resources.pricing_unit IS 'Vocabulário governado RENTAL_PRICING_UNITS (manifest) — DECISION-0151 ADENDO A';
COMMENT ON COLUMN rentable_resources.price_cents IS 'REGISTRO do preço anunciado (Δbank=0; execução=PORTA-1) — DECISION-0151 ADENDO A';
COMMIT;
