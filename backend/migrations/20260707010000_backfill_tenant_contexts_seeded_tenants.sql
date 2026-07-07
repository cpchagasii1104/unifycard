-- ============================================================
-- 20260707010000: Backfill tenant_contexts para tenants semeados por SQL
-- ============================================================
-- Causa: tenants criados por INSERT direto em migration (ex.: unificard-inicial
-- em 20260611120000, system-tenant) pulam tenant.service.createTenant e portanto
-- o bootstrapTenantContexts — ficando sem autoridade de leitura da árvore de
-- categorias (CONTEXT_ACCESS_DENIED em professional/interest/learning/...).
-- Cura: mesmo padrão idempotente da 0091 (precedente normativo), compondo da
-- MESMA lista governada (DEFAULT_TENANT_CATEGORY_CONTEXTS / CategoryContext).
-- Forward-only; ON CONFLICT ausente por WHERE NOT EXISTS (idêntico à 0091).
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
