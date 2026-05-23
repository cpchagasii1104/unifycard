-- Alinha product_offers à nomenclatura canónica (código já espera estes nomes).
-- price NUMERIC → price_cents BIGINT (centavos); stock → available_quantity; active → is_active.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'price'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'price_cents'
    ) THEN
      ALTER TABLE product_offers ADD COLUMN price_cents BIGINT;
    END IF;

    UPDATE product_offers
    SET price_cents = GREATEST(0, ROUND(price * 100)::bigint)
    WHERE price_cents IS NULL;

    ALTER TABLE product_offers ALTER COLUMN price_cents SET NOT NULL;
    ALTER TABLE product_offers DROP COLUMN price;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'price_cents'
  ) THEN
    ALTER TABLE product_offers DROP CONSTRAINT IF EXISTS product_offers_price_cents_nonneg;
    ALTER TABLE product_offers
      ADD CONSTRAINT product_offers_price_cents_nonneg CHECK (price_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'stock'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'available_quantity'
  ) THEN
    ALTER TABLE product_offers RENAME COLUMN stock TO available_quantity;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_product_offers_active;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE product_offers RENAME COLUMN active TO is_active;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_offers_active
  ON product_offers (tenant_id, merchant_id, is_active)
  WHERE is_active = true;

COMMENT ON COLUMN product_offers.price_cents IS 'Preço da oferta em centavos (inteiro).';
COMMENT ON COLUMN product_offers.available_quantity IS 'Cache opcional de quantidade disponível; SSOT físico: inventory_movements.';
COMMENT ON COLUMN product_offers.is_active IS 'Oferta ativa no catálogo.';

COMMIT;
