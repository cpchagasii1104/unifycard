-- ============================================================
-- 20260416100000: product_prices + promotions — nomenclatura (07_NOMENCLATURA_CANONICA)
-- §4.7  price NUMERIC → price_cents BIGINT
-- §4.7  promotions.value NUMERIC → value_cents BIGINT
-- §4.11 type / applies_to em lowercase no CHECK
--
-- Deploy atómico com código: repositórios + PricingService + rotas + E2E.
-- value_cents: fixed = centavos; percentage = percentual×100 (10% → 1000).
-- Substituído por discount_fixed_cents + discount_rate_bps em 20260416140000 (§4.8 bps).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. product_prices: price → price_cents
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_prices' AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_prices' AND column_name = 'price_cents'
  ) THEN
    ALTER TABLE product_prices ADD COLUMN price_cents BIGINT;

    UPDATE product_prices
    SET price_cents = GREATEST(0, ROUND(price * 100)::BIGINT);

    ALTER TABLE product_prices ALTER COLUMN price_cents SET NOT NULL;
    ALTER TABLE product_prices ADD CONSTRAINT chk_product_prices_cents_nonneg
      CHECK (price_cents >= 0);
    ALTER TABLE product_prices DROP COLUMN price;
  END IF;
END $$;

COMMENT ON COLUMN product_prices.price_cents IS
  'Preço base em centavos (BIGINT). §4.7 Nomenclatura Canônica.';

-- ---------------------------------------------------------------------------
-- 2. promotions: value → value_cents (só se coluna value ainda existir)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  con_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promotions' AND column_name = 'value'
  ) THEN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'promotions'
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE promotions DROP CONSTRAINT %I', con_name);
  END LOOP;

  ALTER TABLE promotions ADD COLUMN IF NOT EXISTS value_cents BIGINT;

  UPDATE promotions
  SET value_cents = GREATEST(0, ROUND(value * 100)::BIGINT)
  WHERE LOWER(type::text) IN ('fixed', 'percentage');

  UPDATE promotions SET value_cents = 0 WHERE value_cents IS NULL;

  ALTER TABLE promotions ALTER COLUMN value_cents SET NOT NULL;
  ALTER TABLE promotions ADD CONSTRAINT chk_promotions_value_cents_nonneg
    CHECK (value_cents >= 0);
  ALTER TABLE promotions DROP COLUMN value;
  END IF;
END $$;

-- Normalizar enums + garantir CHECKs lowercase (idempotente)
UPDATE promotions SET type = LOWER(TRIM(type::text)) WHERE type IS NOT NULL;
UPDATE promotions SET applies_to = LOWER(TRIM(applies_to::text)) WHERE applies_to IS NOT NULL;

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_type_check;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_applies_to_check;

ALTER TABLE promotions ADD CONSTRAINT promotions_type_check
  CHECK (type IN ('percentage', 'fixed'));

ALTER TABLE promotions ADD CONSTRAINT promotions_applies_to_check
  CHECK (applies_to IN ('variant', 'category', 'product'));

COMMENT ON COLUMN promotions.value_cents IS
  'fixed: desconto em centavos. percentage: percentual×100 (10%% → 1000). §4.7.';
COMMENT ON COLUMN promotions.type IS
  'percentage | fixed. Lowercase. §4.11.';
COMMENT ON COLUMN promotions.applies_to IS
  'variant | category | product. Lowercase. §4.11.';

COMMIT;
