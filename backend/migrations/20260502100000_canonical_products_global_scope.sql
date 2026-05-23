-- Fase 2A: suporte a catálogo global em canonical_products (schema apenas).
-- scope = 'global' ⇒ tenant_id NULL; scope = 'scoped' ⇒ tenant_id NOT NULL.
-- Não altera código da aplicação; aplicar migrate após revisão humana.

BEGIN;

-- 1. Coluna scope
ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'scoped'
    CHECK (scope IN ('global', 'scoped'));

-- 2. tenant_id nullable (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'canonical_products'
      AND column_name = 'tenant_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE canonical_products ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Consistência scope ↔ tenant_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_canonical_scope_tenant'
  ) THEN
    ALTER TABLE canonical_products
      ADD CONSTRAINT chk_canonical_scope_tenant CHECK (
        (scope = 'global' AND tenant_id IS NULL) OR
        (scope = 'scoped' AND tenant_id IS NOT NULL)
      );
  END IF;
END $$;

-- 4. Índices GTIN (parciais global vs scoped)
-- Em alguns PG o UNIQUE INDEX expõe-se como constraint com o mesmo nome — DROP INDEX falha (2BP01).
ALTER TABLE canonical_products DROP CONSTRAINT IF EXISTS uidx_canonical_products_tenant_gtin;
DROP INDEX IF EXISTS uidx_canonical_products_tenant_gtin;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_gtin_global
  ON canonical_products (gtin)
  WHERE gtin IS NOT NULL AND scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_gtin_scoped
  ON canonical_products (tenant_id, gtin)
  WHERE gtin IS NOT NULL AND scope = 'scoped';

-- 5. Índices fingerprint (parciais; NULL ≠ NULL em único composto)
ALTER TABLE canonical_products DROP CONSTRAINT IF EXISTS uidx_canonical_products_fingerprint_v1;
DROP INDEX IF EXISTS uidx_canonical_products_fingerprint_v1;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_fingerprint_global
  ON canonical_products (fingerprint_v1)
  WHERE fingerprint_v1 IS NOT NULL AND scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_fingerprint_scoped
  ON canonical_products (tenant_id, fingerprint_v1)
  WHERE fingerprint_v1 IS NOT NULL AND scope = 'scoped';

COMMIT;
