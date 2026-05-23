-- Alinhar nome da FK ao contrato actual (b2b_order_id). Ambientes legados criaram `order_id`.
BEGIN;

DO $rename$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'b2b_order_items'
      AND column_name = 'order_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'b2b_order_items'
      AND column_name = 'b2b_order_id'
  ) THEN
    ALTER TABLE b2b_order_items RENAME COLUMN order_id TO b2b_order_id;
  END IF;
END
$rename$;

COMMIT;
