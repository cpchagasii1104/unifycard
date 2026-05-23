-- ============================================================
-- 20260416140000: promotions — §4.7 + §4.8 NOMENCLATURA_CANONICA
-- Separa monetário (centavos) de percentual (basis points).
-- discount_fixed_cents BIGINT — desconto fixo; zero se type = percentage
-- discount_rate_bps INTEGER — 100 = 1%, 10000 = 100%; zero se type = fixed
-- Remove value_cents (dupla semântica).
-- Pré-requisito: 20260416100000 (value_cents populado a partir de value).
-- ============================================================

BEGIN;

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_fixed_cents BIGINT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_rate_bps INTEGER;

UPDATE promotions SET type = LOWER(TRIM(type::text)) WHERE type IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promotions' AND column_name = 'value_cents'
  ) THEN
    UPDATE promotions
    SET
      discount_fixed_cents = CASE WHEN type = 'fixed' THEN value_cents ELSE 0 END,
      discount_rate_bps = CASE WHEN type = 'percentage' THEN (value_cents)::integer ELSE 0 END;
  END IF;
END $$;

UPDATE promotions SET discount_fixed_cents = 0 WHERE discount_fixed_cents IS NULL;
UPDATE promotions SET discount_rate_bps = 0 WHERE discount_rate_bps IS NULL;

ALTER TABLE promotions ALTER COLUMN discount_fixed_cents SET NOT NULL;
ALTER TABLE promotions ALTER COLUMN discount_rate_bps SET NOT NULL;

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_value_cents_nonneg;
ALTER TABLE promotions DROP COLUMN IF EXISTS value_cents;

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_discount_shape;
ALTER TABLE promotions ADD CONSTRAINT chk_promotions_discount_shape CHECK (
  (
    type = 'fixed'
    AND discount_rate_bps = 0
    AND discount_fixed_cents >= 0
  )
  OR
  (
    type = 'percentage'
    AND discount_fixed_cents = 0
    AND discount_rate_bps >= 0
    AND discount_rate_bps <= 10000
  )
);

COMMENT ON COLUMN promotions.discount_fixed_cents IS
  'Desconto fixo em centavos (BIGINT, §4.7). Obrigatoriamente 0 quando type = percentage.';
COMMENT ON COLUMN promotions.discount_rate_bps IS
  'Percentual em basis points (§4.8). 100 = 1%, 1000 = 10%. Obrigatoriamente 0 quando type = fixed.';

COMMIT;
