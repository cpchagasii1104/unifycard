-- ============================================================
-- 0109: categories — validação semântica N2 professional (pós-0092)
-- ============================================================
-- Contexto: 0092 removeu tenant_id de public.categories (ontologia global).
-- Enforcement físico de N2 por concept+scope: ux_category_concept_scope (0097):
--   UNIQUE (concept_id, scope) WHERE level = 2
-- Esta migration NÃO cria índice em tenant_id (coluna inexistente após 0092).
-- Garante apenas fail-fast se dados já violarem unicidade lógica em professional N2.
-- Norma: Lei 7; Lei 2 forward-only; Lei 3 falha explícita
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_dup INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_dup
  FROM (
    SELECT concept_id
    FROM categories
    WHERE scope = 'professional'
      AND level = 2
      AND concept_id IS NOT NULL
    GROUP BY concept_id
    HAVING COUNT(*) > 1
  ) d;

  IF v_dup > 0 THEN
    RAISE EXCEPTION
      '0109: existem % concept_id duplicados em N2 professional. Corrija dados antes de continuar.',
      v_dup;
  END IF;
END $$;

COMMENT ON INDEX ux_category_concept_scope IS
  '0097+0109: UNIQUE (concept_id, scope) em level=2 — um conceito por scope no N2; após 0092 categories é global (sem tenant_id).';

COMMIT;
