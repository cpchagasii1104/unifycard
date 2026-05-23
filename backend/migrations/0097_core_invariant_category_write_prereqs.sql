-- ============================================================
-- 0097: Pré-requisitos Category Write Pipeline (sem trigger / sem seed)
-- ============================================================
-- SSOT semântico: apenas public.concepts (sem concept_nodes).
-- Escrita: public.categories com colunas existentes.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS core_invariant;

CREATE TABLE IF NOT EXISTS core_invariant.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_core_invariant_audit_log_event
  ON core_invariant.audit_log (event_type, created_at DESC);

COMMENT ON TABLE core_invariant.audit_log IS
  'Auditoria do pipeline de escrita em categories; SSOT semântico permanece em public.concepts.';

REVOKE ALL ON SCHEMA core_invariant FROM PUBLIC;
GRANT USAGE ON SCHEMA core_invariant TO PUBLIC;

CREATE OR REPLACE FUNCTION core_invariant.create_category_from_concept(
  p_concept_id UUID,
  p_parent_slug VARCHAR(255),
  p_scope VARCHAR(50) DEFAULT 'professional',
  p_sort_order INTEGER DEFAULT 0
)
RETURNS TABLE (
  category_id UUID,
  created BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core_invariant, public
AS $$
DECLARE
  v_concept RECORD;
  v_parent_id UUID;
  v_parent_level INTEGER;
  v_parent_path TEXT[];
  v_parent_slug TEXT;
  v_existing UUID;
  v_new_id UUID;
  v_level INTEGER;
  v_path TEXT[];
  v_name TEXT;
BEGIN
  p_sort_order := COALESCE(p_sort_order, 0);

  SELECT c.concept_id, c.slug, c.domain
  INTO v_concept
  FROM public.concepts c
  WHERE c.concept_id = p_concept_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'CONCEPT_NOT_FOUND: ' || p_concept_id::TEXT;
    RETURN;
  END IF;

  -- Contexto profissional operacional: domain servicos (alinhado a seeds N2)
  IF p_scope = 'professional' AND v_concept.domain IS DISTINCT FROM 'servicos' THEN
    RETURN QUERY SELECT
      NULL::UUID,
      FALSE,
      'INVALID_DOMAIN_FOR_PROFESSIONAL: ' || COALESCE(v_concept.domain, 'NULL')
      || ' (expected servicos)';
    RETURN;
  END IF;

  IF p_parent_slug IS NOT NULL THEN
    SELECT c.category_id, c.level, c.path, c.slug
    INTO v_parent_id, v_parent_level, v_parent_path, v_parent_slug
    FROM public.categories c
    WHERE c.slug = p_parent_slug
      AND c.scope = p_scope
      AND c.level = 1;

    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'PARENT_NOT_FOUND: ' || p_parent_slug;
      RETURN;
    END IF;

    IF COALESCE(array_length(v_parent_path, 1), 0) IS DISTINCT FROM v_parent_level THEN
      RAISE EXCEPTION 'INVALID_PARENT_PATH_STRUCTURE: parent=% level=% path=%',
        p_parent_slug, v_parent_level, v_parent_path;
    END IF;
  END IF;

  IF p_parent_slug IS NULL THEN
    v_level := 0;
    v_path := ARRAY[]::TEXT[];
  ELSE
    v_level := v_parent_level + 1;
    -- path canónico: ancestrais do novo nó = parent.path || parent.slug (sem slug do novo N2)
    v_path := v_parent_path || ARRAY[v_parent_slug::TEXT];
  END IF;

  SELECT c.category_id INTO v_existing
  FROM public.categories c
  WHERE c.concept_id = p_concept_id
    AND c.scope = p_scope
    AND c.level = 2;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing, FALSE, 'ALREADY_EXISTS: category for this concept'::TEXT;
    RETURN;
  END IF;

  v_name := initcap(replace(v_concept.slug, '-', ' '));
  IF length(trim(v_name)) = 0 THEN
    v_name := v_concept.slug;
  END IF;

  PERFORM set_config('app.pipeline_origin', 'create_category_from_concept', true);

  INSERT INTO public.categories (
    name,
    slug,
    description,
    level,
    path,
    parent_id,
    scope,
    concept_id,
    status,
    requires_review,
    created_by_ai,
    is_active,
    keywords,
    metadata
  ) VALUES (
    v_name,
    v_concept.slug,
    NULL,
    v_level,
    v_path,
    v_parent_id,
    p_scope,
    p_concept_id,
    'active',
    false,
    false,
    true,
    '[]'::jsonb,
    jsonb_build_object('pipeline_sort_order', p_sort_order)
  )
  RETURNING public.categories.category_id INTO v_new_id;

  PERFORM set_config('app.pipeline_origin', '', true);

  INSERT INTO core_invariant.audit_log (event_type, entity_type, entity_id, payload)
  VALUES (
    'CREATE_CATEGORY_FROM_CONCEPT',
    'CATEGORY',
    v_new_id,
    jsonb_build_object(
      'concept_id', p_concept_id,
      'parent_slug', p_parent_slug,
      'scope', p_scope,
      'actor', session_user::TEXT
    )
  );

  RETURN QUERY SELECT v_new_id, TRUE, 'CREATED_SUCCESSFULLY'::TEXT;
END;
$$;

COMMENT ON FUNCTION core_invariant.create_category_from_concept IS
  'N2 em public.categories a partir de public.concepts; sem segundo SSOT.';

ALTER FUNCTION core_invariant.create_category_from_concept(UUID, VARCHAR, VARCHAR, INTEGER)
  OWNER TO CURRENT_USER;

GRANT EXECUTE ON FUNCTION core_invariant.create_category_from_concept(UUID, VARCHAR, VARCHAR, INTEGER)
  TO PUBLIC;

CREATE UNIQUE INDEX IF NOT EXISTS ux_category_concept_scope
  ON public.categories (concept_id, scope)
  WHERE level = 2;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS chk_n2_requires_concept;

ALTER TABLE public.categories
  ADD CONSTRAINT chk_n2_requires_concept
  CHECK (level <> 2 OR concept_id IS NOT NULL)
  NOT VALID;

ALTER TABLE public.categories
  VALIDATE CONSTRAINT chk_n2_requires_concept;

COMMIT;
