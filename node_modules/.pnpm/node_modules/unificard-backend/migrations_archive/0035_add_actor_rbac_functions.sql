-- Migration 300: Add Actor-based RBAC Functions
-- Elimina dependência estrutural de user_id no RBAC V2
-- Conforme RBAC_V2_CONTRACT.md: RBAC decide apenas com actorId + intent + scope

-- Função: actor_has_permission
-- Verifica se um actor tem uma permissão específica
-- Encapsula mapeamento actor_id → user_id sem expor user_id na interface
CREATE OR REPLACE FUNCTION actor_has_permission(
  p_tenant_id UUID,
  p_actor_id UUID,
  p_resource VARCHAR,
  p_action VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM actors a
    JOIN user_roles ur ON a.user_id = ur.user_id AND a.tenant_id = ur.tenant_id
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.permission_id
    WHERE a.actor_id = p_actor_id
      AND a.tenant_id = p_tenant_id
      AND ur.tenant_id = p_tenant_id
      AND p.resource = p_resource
      AND p.action = p_action
  );
END;
$$ LANGUAGE plpgsql;

-- Função: actor_has_any_role
-- Verifica se um actor tem QUALQUER uma das roles listadas
-- Encapsula mapeamento actor_id → user_id sem expor user_id na interface
CREATE OR REPLACE FUNCTION actor_has_any_role(
  p_tenant_id UUID,
  p_actor_id UUID,
  p_role_names TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM actors a
    JOIN user_roles ur ON a.user_id = ur.user_id AND a.tenant_id = ur.tenant_id
    JOIN roles r ON ur.role_id = r.role_id
    WHERE a.actor_id = p_actor_id
      AND a.tenant_id = p_tenant_id
      AND ur.tenant_id = p_tenant_id
      AND r.name = ANY(p_role_names)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION actor_has_permission IS 'RBAC V2: Verifica permissão por actor_id (sem expor user_id)';
COMMENT ON FUNCTION actor_has_any_role IS 'RBAC V2: Verifica roles por actor_id (sem expor user_id)';

