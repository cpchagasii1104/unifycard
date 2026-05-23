-- ============================================================
-- 0061: categories (mínimo multi-tenant + hierarquia)
-- ============================================================
-- Uso: seed-dev-complete, categories.repository, SSOT de categorias.
-- PK = category_id (contrato do código; não usar "id" como PK).
-- tenant_id preenchido por trigger a partir de app.current_tenant quando NULL.
-- ============================================================

BEGIN;

CREATE TABLE categories (
  category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  parent_id UUID REFERENCES categories (category_id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
  path TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  country_code CHAR(2),
  scope VARCHAR(50) NOT NULL DEFAULT 'global'
    CHECK (scope IN (
      'global',
      'group',
      'company',
      'event',
      'campaign',
      'professional',
      'interest',
      'learning',
      'cause'
    )),
  status TEXT NOT NULL DEFAULT 'active',
  requires_review BOOLEAN NOT NULL DEFAULT false,
  created_by_ai BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> category_id),
  CONSTRAINT categories_tenant_slug_key UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_categories_tenant ON categories (tenant_id);
CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_categories_tenant_scope ON categories (tenant_id, scope);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION categories_set_tenant_id()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := current_setting('app.current_tenant', true)::uuid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_categories_set_tenant_id
  BEFORE INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION categories_set_tenant_id();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'categories'
      AND policyname = 'categories_rls'
  ) THEN
    CREATE POLICY categories_rls ON categories
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

COMMENT ON TABLE categories IS 'Categorias hierárquicas por tenant (contrato category_id + tenant_id).';

COMMIT;
