-- ============================================================
-- 0007_system_functions.sql
-- Funções auxiliares sistêmicas reutilizáveis
-- Pré-requisito para qualquer migration que use triggers de updated_at
-- MODO: Constitucional Rígido
-- HARD MODE: Sem IF NOT EXISTS
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

BEGIN;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_actors_updated_at
  BEFORE UPDATE ON actors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO schema_version (version) VALUES (7);

COMMIT;

-- ============================================================
-- FIM DA MIGRATION 0007
-- ============================================================
