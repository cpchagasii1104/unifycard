-- BASELINE
-- Representa o estado atual consolidado do schema `canonical_products` alinhado ao banco de desenvolvimento
-- válido após reconstrução (gênesis). Substitui, no repositório, histórico de ficheiros `2026040114*` que
-- chegaram a ser aplicados no ambiente mas não estão versionados no tree.
--
-- Regras: idempotente; não remove dados; não altera `migrations_archive`.
-- O runner oficial de migrations (`migrate.ts`) só aplica `backend/migrations/`, não o arquivo.

BEGIN;

CREATE TABLE IF NOT EXISTS canonical_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants (id) ON DELETE CASCADE,
  gtin VARCHAR,
  name TEXT NOT NULL,
  brand TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_id UUID
    REFERENCES categories (category_id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'INDUSTRIAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_products_tenant_gtin
  ON canonical_products (tenant_id, gtin);

CREATE INDEX IF NOT EXISTS idx_canonical_products_tenant
  ON canonical_products (tenant_id);

CREATE INDEX IF NOT EXISTS idx_canonical_products_tenant_category
  ON canonical_products (tenant_id, category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_products_tenant_gtin_lookup
  ON canonical_products (tenant_id, gtin)
  WHERE gtin IS NOT NULL;

COMMENT ON TABLE canonical_products IS
  'Catálogo industrial canónico por tenant (GTIN + metadados). Baseline versionada; SSOT de linha no código + FKs de produtos/ofertas onde aplicável.';

COMMIT;
