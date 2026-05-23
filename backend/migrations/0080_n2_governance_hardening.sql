-- ============================================================
-- 0080: N2/CONTEXT — mensagem padronizada, DELETE bloqueado, imutabilidade
-- ============================================================
-- Norma: 20_N2_NAVIGATION_STRUCTURE_UNIFICARD §11.7, §11.8
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION enforce_n2_tree_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.n2_governance', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'n2_governance_violation: write requires app.n2_governance = true (authorized transaction)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'n2_nodes' THEN
      IF OLD.slug IS DISTINCT FROM NEW.slug OR OLD.n1_id IS DISTINCT FROM NEW.n1_id THEN
        RAISE EXCEPTION 'n2_immutability: n2_nodes.slug and n1_id are immutable (RFC + governance)'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF TG_TABLE_NAME = 'context_nodes' THEN
      IF OLD.context_slug IS DISTINCT FROM NEW.context_slug
         OR OLD.domain_key IS DISTINCT FROM NEW.domain_key THEN
        RAISE EXCEPTION 'n2_immutability: context_nodes.context_slug and domain_key are immutable (RFC + governance)'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF TG_TABLE_NAME = 'context_n2_mapping' THEN
      IF OLD.context_id IS DISTINCT FROM NEW.context_id OR OLD.n2_id IS DISTINCT FROM NEW.n2_id THEN
        RAISE EXCEPTION 'n2_immutability: context_n2_mapping.context_id and n2_id are immutable (RFC + governance)'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_n2_nodes_governance ON n2_nodes;
CREATE TRIGGER trg_n2_nodes_governance
  BEFORE INSERT OR UPDATE OR DELETE ON n2_nodes
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_context_nodes_governance ON context_nodes;
CREATE TRIGGER trg_context_nodes_governance
  BEFORE INSERT OR UPDATE OR DELETE ON context_nodes
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_context_n2_mapping_governance ON context_n2_mapping;
CREATE TRIGGER trg_context_n2_mapping_governance
  BEFORE INSERT OR UPDATE OR DELETE ON context_n2_mapping
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_context_localized_governance ON context_localized_names;
CREATE TRIGGER trg_context_localized_governance
  BEFORE INSERT OR UPDATE OR DELETE ON context_localized_names
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_n2_localized_governance ON n2_localized_names;
CREATE TRIGGER trg_n2_localized_governance
  BEFORE INSERT OR UPDATE OR DELETE ON n2_localized_names
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

COMMENT ON FUNCTION enforce_n2_tree_governance() IS
  'Bloqueia INSERT/UPDATE/DELETE sem app.n2_governance; imutabilidade de identificadores em UPDATE (§11.8).';

COMMIT;
