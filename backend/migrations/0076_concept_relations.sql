-- ============================================================
-- 0076: concept_relations (grafo semântico concept → concept)
-- ============================================================
-- Camada acima de category_relations: arestas por concept_id (N0 + slug já em concepts).
-- Não substitui category_relations; getRelatedConcepts usa isto primeiro, depois fallback.
-- ============================================================

BEGIN;

CREATE TABLE concept_relations (
  relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  subject_concept_id UUID NOT NULL REFERENCES concepts (concept_id) ON DELETE CASCADE,
  object_concept_id UUID NOT NULL REFERENCES concepts (concept_id) ON DELETE CASCADE,

  relation_type TEXT NOT NULL CHECK (
    relation_type IN (
      'enables',
      'evolves_to',
      'related_to'
    )
  ),

  weight INTEGER NOT NULL DEFAULT 1,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT concept_relations_no_self_loop CHECK (subject_concept_id <> object_concept_id),
  UNIQUE (tenant_id, subject_concept_id, object_concept_id, relation_type)
);

CREATE INDEX idx_concept_relations_tenant_subject
  ON concept_relations (tenant_id, subject_concept_id);

CREATE INDEX idx_concept_relations_tenant_object
  ON concept_relations (tenant_id, object_concept_id);

COMMENT ON TABLE concept_relations IS
  'Grafo semântico concept→concept por tenant; leitura preferencial em graph.adapter com fallback a category_relations.';

COMMIT;
