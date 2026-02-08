-- Migration 300: Add Actor-based RBAC Functions
-- RBAC V2: interface por actor_id, com mapeamento transitório actor -> user
-- ATENÇÃO: user_id ainda é usado internamente por compatibilidade histórica
-- Conforme RBAC_V2_CONTRACT.md

-- ============================================================
-- Função: actor_has_permission
-- Verifica se um actor possui uma permissão (resource + action)
-- Interface externa NÃO expõe user_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.actor_has_permission(
  p_tenant_id UUID,
  p_actor_id  UUID,
  p_resource  VARCHAR,
  p_action    VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM public.actors a
      JOIN public.user_roles ur
        ON a.user_id   = ur.user_id
       AND ur.tenant_id = p_tenant_id
      JOIN public.role_permissions rp
        ON ur.role_id = rp.role_id
      JOIN public.permissions p
        ON rp.permission_id = p.permission_id
     WHERE a.actor_id  = p_actor_id
       AND a.tenant_id = p_tenant_id
       AND p.resource  = p_resource
       AND p.action    = p_action
  );
END;
$$;

COMMENT ON FUNCTION public.actor_has_permission IS
'RBAC V2: verifica permissão por actor_id. user_id é usado apenas internamente (compatibilidade transitória).';

-- ============================================================
-- Função: actor_has_any_role
-- Verifica se um actor possui QUALQUER role da lista
-- Interface externa NÃO expõe user_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.actor_has_any_role(
  p_tenant_id  UUID,
  p_actor_id   UUID,
  p_role_names TEXT[]
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM public.actors a
      JOIN public.user_roles ur
        ON a.user_id   = ur.user_id
       AND ur.tenant_id = p_tenant_id
      JOIN public.roles r
        ON ur.role_id = r.role_id
     WHERE a.actor_id  = p_actor_id
       AND a.tenant_id = p_tenant_id
       AND r.name = ANY(p_role_names)
  );
END;
$$;

COMMENT ON FUNCTION public.actor_has_any_role IS
'RBAC V2: verifica roles por actor_id. user_id é usado apenas internamente (compatibilidade transitória).';
