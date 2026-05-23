-- Corrige trigger inventory_movements: search_path sem `public` impedia resolver `actors`
-- (erro "relação actors não existe" em INSERT mesmo com tabela criada).

BEGIN;

CREATE OR REPLACE FUNCTION inventory_movements_enforce_actor_tenant()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.actors a
    WHERE a.id = NEW.actor_id AND a.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'inventory_movements.actor_id must belong to the same tenant_id as the row';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
