-- 20260510200000_actor_responsibility_enforce.sql
-- §4.8 — FASE 4: enforcement total (WARNING → EXCEPTION)

BEGIN;

CREATE OR REPLACE FUNCTION trg_actor_responsibility_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_responsible_type TEXT;
BEGIN
  IF NEW.actor_type IN ('user', 'actor_human', 'person') THEN
    IF NEW.responsible_actor_id IS NOT NULL THEN
      RAISE EXCEPTION 'Actor humano (tipo=%) não pode ter responsible_actor_id.', NEW.actor_type;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.actor_type IN ('actor_system', 'system') THEN
    RETURN NEW;
  END IF;

  IF NEW.responsible_actor_id IS NULL THEN
    RAISE EXCEPTION
      'Actor não-humano (tipo=%) requer responsible_actor_id. §4.8 LEI_COERENCIA_SISTEMICA.',
      NEW.actor_type;
  END IF;

  SELECT actor_type INTO v_responsible_type
  FROM actors
  WHERE id = NEW.responsible_actor_id AND tenant_id = NEW.tenant_id;

  IF v_responsible_type IS NULL THEN
    RAISE EXCEPTION 'responsible_actor_id=% não encontrado no tenant=%.', NEW.responsible_actor_id, NEW.tenant_id;
  END IF;

  IF v_responsible_type NOT IN ('user', 'actor_human', 'person') THEN
    RAISE EXCEPTION 'responsible_actor_id deve ser actor humano. Encontrado: %.', v_responsible_type;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
