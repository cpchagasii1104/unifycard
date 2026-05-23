-- ============================================================
-- 0077: governança de INSERT/UPDATE em concept_relations
-- ============================================================
-- Escrita só com app.graph_governance = 'true' (set_config local).
-- Código: graph-governance.service.ts
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION enforce_concept_relation_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.graph_governance', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'concept relation write blocked: use graph-governance.service (set app.graph_governance in authorized transaction)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concept_relation_governance ON concept_relations;

CREATE TRIGGER trg_concept_relation_governance
  BEFORE INSERT OR UPDATE ON concept_relations
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_concept_relation_governance();

COMMENT ON FUNCTION enforce_concept_relation_governance() IS
  'Bloqueia INSERT/UPDATE diretos em concept_relations; exige app.graph_governance = true.';

COMMIT;
