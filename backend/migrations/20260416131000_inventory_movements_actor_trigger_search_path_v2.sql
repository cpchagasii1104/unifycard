-- inventory_movements_enforce_actor_tenant: preferir search_path com `public` a hardcode `public.actors`
-- (compatível com futura reorganização de schemas desde que `actors` permaneça resolvível em `public`).

BEGIN;

CREATE OR REPLACE FUNCTION inventory_movements_enforce_actor_tenant()
RETURNS TRIGGER
SET search_path = public, pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM actors a
    WHERE a.id = NEW.actor_id AND a.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'inventory_movements.actor_id must belong to the same tenant_id as the row';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
