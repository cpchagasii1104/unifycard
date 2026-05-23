-- ============================================================
-- 0092: Grafo semântico global (categories + relations)
-- ============================================================
-- Pacote atómico: remove tenant_id de semântica (categorias e arestas).
-- Pré-requisito: backup (pg_dump ou scripts/backup-semantic-graph-tables.mjs).
-- Rollback: restaurar backup — não recriar tenant_id sem dados.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Fundir category_id duplicados por slug (vários tenants → um id canónico)
-- ---------------------------------------------------------------------------
CREATE TABLE _migration_category_merge (
  old_id UUID PRIMARY KEY,
  new_id UUID NOT NULL
);

INSERT INTO _migration_category_merge (old_id, new_id)
SELECT c.category_id, k.keep_id
FROM categories c
INNER JOIN (
  SELECT slug, (array_agg(category_id ORDER BY created_at ASC NULLS LAST, category_id ASC))[1] AS keep_id
  FROM categories
  GROUP BY slug
  HAVING COUNT(*) > 1
) k ON c.slug = k.slug AND c.category_id <> k.keep_id;

UPDATE category_relations cr
SET from_category_id = m.new_id
FROM _migration_category_merge m
WHERE cr.from_category_id = m.old_id;

UPDATE category_relations cr
SET to_category_id = m.new_id
FROM _migration_category_merge m
WHERE cr.to_category_id = m.old_id;

UPDATE category_n1_mapping cn
SET category_id = m.new_id
FROM _migration_category_merge m
WHERE cn.category_id = m.old_id;

UPDATE categories c
SET parent_id = m.new_id
FROM _migration_category_merge m
WHERE c.parent_id = m.old_id;

UPDATE products p
SET category_id = m.new_id
FROM _migration_category_merge m
WHERE p.category_id = m.old_id;

DELETE FROM categories WHERE category_id IN (SELECT old_id FROM _migration_category_merge);

DROP TABLE _migration_category_merge;

-- ---------------------------------------------------------------------------
-- 1) category_relations: dedupe + remover tenant_id
-- ---------------------------------------------------------------------------
DELETE FROM category_relations a
WHERE a.ctid NOT IN (
  SELECT MIN(cr.ctid)
  FROM category_relations cr
  GROUP BY cr.from_category_id, cr.to_category_id, cr.relation_type
);

ALTER TABLE category_relations DROP CONSTRAINT IF EXISTS category_relations_tenant_id_fkey;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.category_relations'::regclass
      AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE category_relations DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE category_relations DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE category_relations
  ADD CONSTRAINT category_relations_edge_uq
  UNIQUE (from_category_id, to_category_id, relation_type);

-- ---------------------------------------------------------------------------
-- 2) concept_relations: dedupe + remover tenant_id
-- ---------------------------------------------------------------------------
DELETE FROM concept_relations a
WHERE a.ctid NOT IN (
  SELECT MIN(cr.ctid)
  FROM concept_relations cr
  GROUP BY cr.subject_concept_id, cr.object_concept_id, cr.relation_type
);

ALTER TABLE concept_relations DROP CONSTRAINT IF EXISTS concept_relations_tenant_id_fkey;

DROP INDEX IF EXISTS idx_concept_relations_tenant_subject;
DROP INDEX IF EXISTS idx_concept_relations_tenant_object;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.concept_relations'::regclass
      AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE concept_relations DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE concept_relations DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE concept_relations
  ADD CONSTRAINT concept_relations_edge_uq
  UNIQUE (subject_concept_id, object_concept_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_concept_relations_subject
  ON concept_relations (subject_concept_id);

CREATE INDEX IF NOT EXISTS idx_concept_relations_object
  ON concept_relations (object_concept_id);

-- ---------------------------------------------------------------------------
-- 3) categories: RLS, trigger, tenant_id, UNIQUE(slug)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS categories_rls ON categories;

ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_categories_set_tenant_id ON categories;

DROP FUNCTION IF EXISTS categories_set_tenant_id();

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_tenant_id_fkey;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_tenant_slug_key;

DROP INDEX IF EXISTS idx_categories_tenant;
DROP INDEX IF EXISTS idx_categories_tenant_scope;

ALTER TABLE categories DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE categories
  ADD CONSTRAINT categories_slug_key UNIQUE (slug);

COMMENT ON TABLE categories IS 'Ontologia global N0–N3; slug único no sistema; sem tenant_id.';

COMMENT ON TABLE category_relations IS 'Arestas globais entre category_id; SSOT de grafo legado (fallback).';

COMMENT ON TABLE concept_relations IS 'Arestas globais concept→concept; camada preferencial em graph.adapter.';

COMMIT;
