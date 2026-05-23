-- Fase D (plano-fase-atual §6): integridade de products.category_id.
-- Pré-requisito: categories globais (0092); PK = category_id.
-- Ordem: validar dados → NOT NULL → FK.
-- Se o DO $$ falhar: corrigir NULLs ou category_id órfãos antes de reaplicar.
BEGIN;

DO $$
DECLARE
  n_null INTEGER;
  n_orphan INTEGER;
BEGIN
  SELECT COUNT(*)::INT INTO n_null FROM products WHERE category_id IS NULL;
  IF n_null > 0 THEN
    RAISE EXCEPTION
      'products.category_id NULL em % linha(s) — backfill ou remoção antes de NOT NULL (plano §6)',
      n_null;
  END IF;

  SELECT COUNT(*)::INT INTO n_orphan
  FROM products p
  WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.category_id = p.category_id
  );
  IF n_orphan > 0 THEN
    RAISE EXCEPTION
      'products com category_id sem correspondência em categories: % linha(s)',
      n_orphan;
  END IF;
END $$;

ALTER TABLE products
  ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE products
  ADD CONSTRAINT fk_products_category
  FOREIGN KEY (category_id)
  REFERENCES categories (category_id)
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_products_category ON products IS
  'Navegação obrigatória: todo product referencia categories (globais pós-0092).';

COMMIT;
