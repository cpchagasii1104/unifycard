-- ============================================================
-- 0075: governança de INSERT em concepts (norma sec. 5.5)
-- ============================================================
-- Só INSERT permitido com app.concept_governance = 'true' na sessão/transação
-- (set_config local). Código autorizado: concept-governance.service e scripts
-- que chamam set_config após BEGIN.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION enforce_concept_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.concept_governance', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'concept insert blocked: use concept governance (set app.concept_governance in authorized transaction)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concept_governance ON concepts;

CREATE TRIGGER trg_concept_governance
  BEFORE INSERT ON concepts
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_concept_governance();

COMMENT ON FUNCTION enforce_concept_governance() IS
  'Bloqueia INSERT direto em concepts; exige app.concept_governance = true (ver concept-governance.service).';

COMMIT;
