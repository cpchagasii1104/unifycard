-- 20260707070000: grant de leitura do contexto 'group' (padrão 0091/20260707010000)
-- Causa: DEFAULT_TENANT_CATEGORY_CONTEXTS omitia 'group' → wizard de grupo sem categorias
-- (CONTEXT_ACCESS_DENIED silencioso). Fonte TS atualizada no mesmo commit.
BEGIN;
INSERT INTO tenant_contexts (tenant_id, context, permission)
SELECT t.id, 'group', 'read' FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM tenant_contexts tc WHERE tc.tenant_id = t.id AND tc.context = 'group');
COMMIT;
