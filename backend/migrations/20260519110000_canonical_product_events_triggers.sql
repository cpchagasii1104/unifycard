-- Triggers que alimentam canonical_product_events automaticamente.
-- Depende de: 20260519100000_canonical_product_events.sql

BEGIN;

-- Trigger 1: AFTER INSERT → evento 'created'
CREATE OR REPLACE FUNCTION trg_canonical_products_emit_created()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO canonical_product_events (
    canonical_product_id, event_type, payload, tenant_id, created_at
  ) VALUES (
    NEW.id,
    'created',
    jsonb_build_object(
      'type',                      NEW.type,
      'scope',                     NEW.scope,
      'gtin',                      NEW.gtin,
      'concept_resolution_status', NEW.concept_resolution_status
    ),
    NEW.tenant_id,
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpe_on_insert ON canonical_products;
CREATE TRIGGER trg_cpe_on_insert
  AFTER INSERT ON canonical_products
  FOR EACH ROW EXECUTE FUNCTION trg_canonical_products_emit_created();

-- Trigger 2: AFTER UPDATE concept_resolution_status → evento mapeado
-- Mapeamento:
--   confirmed      → concept_resolved
--   unresolved     → concept_resolution_pending
--   auto_suggested → concept_suggestion_auto   (status válido — fila sugeriu, humano não confirmou)
--   qualquer outro → governance_status_changed
CREATE OR REPLACE FUNCTION trg_canonical_products_emit_concept_change()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  -- Só dispara se o status realmente mudou
  IF NEW.concept_resolution_status IS NOT DISTINCT FROM OLD.concept_resolution_status THEN
    RETURN NEW;
  END IF;

  v_event_type := CASE NEW.concept_resolution_status
    WHEN 'confirmed'      THEN 'concept_resolved'
    WHEN 'unresolved'     THEN 'concept_resolution_pending'
    WHEN 'auto_suggested' THEN 'concept_suggestion_auto'
    ELSE 'governance_status_changed'
  END;

  INSERT INTO canonical_product_events (
    canonical_product_id, event_type, payload, tenant_id, created_at
  ) VALUES (
    NEW.id,
    v_event_type,
    jsonb_build_object(
      'from_status', OLD.concept_resolution_status,
      'to_status',   NEW.concept_resolution_status,
      'concept_id',  NEW.concept_id
    ),
    NEW.tenant_id,
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpe_on_concept_change ON canonical_products;
CREATE TRIGGER trg_cpe_on_concept_change
  AFTER UPDATE OF concept_resolution_status ON canonical_products
  FOR EACH ROW EXECUTE FUNCTION trg_canonical_products_emit_concept_change();

COMMIT;
