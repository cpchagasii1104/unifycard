-- ============================================================
-- 20260628120000: core_invariant.create_category_from_concept — fix drift de coluna
-- ============================================================
-- DT-CREATE-CATEGORY-FROM-CONCEPT-COLUMN-DRIFT
-- Contexto: 0061 criou public.categories.created_by_ai; a migration
--   20260530410000_fix_boolean_prefixes RENOMEOU created_by_ai -> is_created_by_ai.
--   Como roda DEPOIS de 0110 (última CREATE OR REPLACE da função), a função
--   governada ficou referenciando a coluna antiga e falhava com
--   'column "created_by_ai" of relation "categories" does not exist'.
-- Correção: CREATE OR REPLACE idêntico ao 0110, trocando APENAS o nome da coluna
--   no INSERT (created_by_ai -> is_created_by_ai). Semântica preservada:
--   mesmo valor literal (false), mesmas demais colunas, mesma idempotência,
--   mesmo audit_log, mesma assinatura. NÃO popula catálogo, NÃO cria concept,
--   NÃO cria service/canonical_service, NÃO altera categories fora da função.
-- Lei 2: forward-only.
-- ============================================================

BEGIN;

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
  WHERE c.concept_id = p_concept_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'CONCEPT_NOT_FOUND: ' || p_concept_id::TEXT;
    RETURN;
  END IF;

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

  BEGIN
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
      is_created_by_ai,
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
  EXCEPTION
    WHEN unique_violation THEN
      SELECT c.category_id INTO v_existing
      FROM public.categories c
      WHERE c.concept_id = p_concept_id
        AND c.scope = p_scope
        AND c.level = 2
      LIMIT 1;

      IF v_existing IS NOT NULL THEN
        PERFORM set_config('app.pipeline_origin', '', true);
        RETURN QUERY SELECT v_existing, FALSE, 'ALREADY_EXISTS: category for this concept (race)'::TEXT;
        RETURN;
      END IF;
      RAISE;
  END;

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
      'model', 'global_categories_post_0092',
      'actor', session_user::TEXT
    )
  );

  RETURN QUERY SELECT v_new_id, TRUE, 'CREATED_SUCCESSFULLY'::TEXT;
END;
$$;

COMMENT ON FUNCTION core_invariant.create_category_from_concept(UUID, VARCHAR, VARCHAR, INTEGER) IS
  'N2 em public.categories (global, sem tenant_id). FOR UPDATE no concept; idempotência por concept+scope+level (0097 ux_category_concept_scope). Coluna alinhada a is_created_by_ai (fix DT-CREATE-CATEGORY-FROM-CONCEPT-COLUMN-DRIFT).';

COMMIT;
