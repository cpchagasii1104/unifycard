-- ============================================================
-- UNIFICARD - MIGRATION 989
-- FASE 2A: Correção de Funções RBAC Actor-Based com Tenant-Safety
-- ============================================================
--
-- OBJETIVO:
-- Corrigir funções actor_has_permission e actor_has_any_role para:
-- 1. Usar mapeamento correto: actors.id -> users.actor_id -> users.id -> user_roles.user_id
-- 2. Garantir isolamento por tenant_id em todos os joins
-- 3. Remover dependência de actors.user_id (inexistente)
--
-- REGRAS:
-- - Modo sombra: não altera comportamento de produção
-- - Tenant-safety: todos os joins verificam tenant_id
-- - Compatibilidade: mantém interface das funções
--
-- ============================================================

-- ============================================================
-- FUNÇÃO: actor_has_permission (CORRIGIDA)
-- ============================================================
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
    JOIN users u ON u.actor_id = a.id AND u.tenant_id = a.tenant_id
    JOIN user_roles ur ON u.id = ur.user_id AND ur.tenant_id = u.tenant_id
    JOIN role_permissions rp ON ur.role_id = rp.role_id AND rp.tenant_id = ur.tenant_id
    JOIN permissions p ON rp.permission_id = p.permission_id AND p.tenant_id = rp.tenant_id
    WHERE a.id = p_actor_id
      AND a.tenant_id = p_tenant_id
      AND p.resource = p_resource
      AND p.action = p_action
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION actor_has_permission IS 
  'RBAC V2: Verifica permissão por actor_id com tenant-safety. Mapeamento: actors.id -> users.actor_id -> users.id -> user_roles.user_id';

-- ============================================================
-- FUNÇÃO: actor_has_any_role (CORRIGIDA)
-- ============================================================
CREATE OR REPLACE FUNCTION actor_has_any_role(
  p_tenant_id UUID,
  p_actor_id UUID,
  p_role_names TEXT[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM actors a
    JOIN users u ON u.actor_id = a.id AND u.tenant_id = a.tenant_id
    JOIN user_roles ur ON u.id = ur.user_id AND ur.tenant_id = u.tenant_id
    JOIN roles r ON ur.role_id = r.role_id AND r.tenant_id = ur.tenant_id
    WHERE a.id = p_actor_id
      AND a.tenant_id = p_tenant_id
      AND r.name = ANY(p_role_names)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION actor_has_any_role IS 
  'RBAC V2: Verifica roles por actor_id com tenant-safety. Mapeamento: actors.id -> users.actor_id -> users.id -> user_roles.user_id';

-- ============================================================
-- ROLLBACK (versões anteriores quebradas - apenas para referência)
-- ============================================================
-- NOTA: As versões anteriores estavam quebradas (usavam actors.user_id inexistente)
-- Este rollback restaura as versões quebradas apenas se necessário reverter
-- 
-- CREATE OR REPLACE FUNCTION actor_has_permission(
--   p_tenant_id UUID,
--   p_actor_id UUID,
--   p_resource VARCHAR,
--   p_action VARCHAR
-- ) RETURNS BOOLEAN AS $$
-- BEGIN
--   RETURN EXISTS (
--     SELECT 1
--     FROM actors a
--     JOIN user_roles ur ON a.user_id = ur.user_id AND a.tenant_id = ur.tenant_id
--     JOIN role_permissions rp ON ur.role_id = rp.role_id
--     JOIN permissions p ON rp.permission_id = p.permission_id
--     WHERE a.actor_id = p_actor_id
--       AND a.tenant_id = p_tenant_id
--       AND ur.tenant_id = p_tenant_id
--       AND p.resource = p_resource
--       AND p.action = p_action
--   );
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE OR REPLACE FUNCTION actor_has_any_role(
--   p_tenant_id UUID,
--   p_actor_id UUID,
--   p_role_names TEXT[]
-- ) RETURNS BOOLEAN AS $$
-- BEGIN
--   RETURN EXISTS (
--     SELECT 1
--     FROM actors a
--     JOIN user_roles ur ON a.user_id = ur.user_id AND a.tenant_id = ur.tenant_id
--     JOIN roles r ON ur.role_id = r.role_id
--     WHERE a.actor_id = p_actor_id
--       AND a.tenant_id = p_tenant_id
--       AND ur.tenant_id = p_tenant_id
--       AND r.name = ANY(p_role_names)
--   );
-- END;
-- $$ LANGUAGE plpgsql;

