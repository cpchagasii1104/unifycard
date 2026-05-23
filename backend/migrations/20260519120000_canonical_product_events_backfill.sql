-- Backfill §5A: eventos 'backfill_category' para canônicos que existiam antes dos triggers.
-- Auditoria: SELECT * FROM canonical_product_events WHERE event_type = 'backfill_category';

BEGIN;

INSERT INTO canonical_product_events (
  canonical_product_id, event_type, payload, tenant_id, created_at
)
SELECT
  cp.id,
  'backfill_category',
  jsonb_build_object(
    'source',      'backfill_category',
    'category_id', cp.category_id,
    'concept_id',  cp.concept_id,
    'scope',       cp.scope,
    'migration',   '20260519120000'
  ),
  cp.tenant_id,
  now()
FROM canonical_products cp
WHERE NOT EXISTS (
  SELECT 1 FROM canonical_product_events cpe
  WHERE cpe.canonical_product_id = cp.id
    AND cpe.event_type IN ('created', 'backfill_category')
);

COMMIT;
