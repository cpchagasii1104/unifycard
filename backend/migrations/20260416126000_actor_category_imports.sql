-- ============================================================
-- 20260416126000: actor_category_imports (marketplace — recorte por actor)
-- Servico: marketplace-categories.service importCategories / getActorCategoryImport
-- FKs corrigidas vs arquivo em migrations_archive (tenants.id, actors.id).
-- ============================================================

BEGIN;

CREATE TABLE actor_category_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE CASCADE,
  category_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  imported_by_actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT actor_category_imports_unique_actor UNIQUE (tenant_id, actor_id)
);

CREATE INDEX idx_actor_category_imports_tenant ON actor_category_imports (tenant_id);
CREATE INDEX idx_actor_category_imports_actor ON actor_category_imports (tenant_id, actor_id);
CREATE INDEX idx_actor_category_imports_categories ON actor_category_imports USING GIN (category_ids);

DROP TRIGGER IF EXISTS trg_actor_category_imports_updated_at ON actor_category_imports;
CREATE TRIGGER trg_actor_category_imports_updated_at
  BEFORE UPDATE ON actor_category_imports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE actor_category_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY actor_category_imports_rls ON actor_category_imports
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

COMMENT ON TABLE actor_category_imports IS
  'Referencias a categorias globais marketplace importadas por actor (sem duplicar taxonomia).';

COMMIT;
