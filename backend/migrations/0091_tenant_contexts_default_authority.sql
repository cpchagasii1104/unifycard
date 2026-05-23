-- ============================================================
-- 0091: Backfill tenant_contexts (autoridade mínima read)
-- ============================================================
-- Todo tenant existente recebe delegação explícita para os contextos
-- canónicos (@unificard/contracts CategoryContext), alinhado a
-- tenant-context-bootstrap.service.ts (DEFAULT_TENANT_CATEGORY_CONTEXTS).
-- ============================================================

BEGIN;

INSERT INTO tenant_contexts (tenant_id, context, permission)
SELECT t.id, x.context, 'read'
FROM tenants t
CROSS JOIN (
  VALUES
    ('professional'),
    ('interest'),
    ('education'),
    ('hobby'),
    ('learning'),
    ('health'),
    ('company'),
    ('lifestyle')
) AS x(context)
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_contexts tc
  WHERE tc.tenant_id = t.id AND tc.context = x.context
);

COMMIT;
