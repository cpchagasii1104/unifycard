-- =========================================================
-- 029_groups_rbac_permissions.sql
-- Seed de permissões RBAC para o módulo Groups
-- =========================================================

-- Função para criar permissões de grupos para um tenant
CREATE OR REPLACE FUNCTION seed_groups_permissions(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
  v_permission_id UUID;
BEGIN
  -- groups:create
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'groups', 'create', 'Criar novos grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- groups:read
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'groups', 'read', 'Visualizar grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- groups:update
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'groups', 'update', 'Atualizar grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- groups:delete
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'groups', 'delete', 'Deletar grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- groups:join
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'groups', 'join', 'Entrar em grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- groups:leave
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'groups', 'leave', 'Sair de grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- groups:members:read
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'groups', 'members:read', 'Visualizar membros de grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- social:groups:read
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'social', 'groups:read', 'Visualizar informações sociais de grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- social:groups:feed:read
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'social', 'groups:feed:read', 'Visualizar feed de grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- social:groups:post
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'social', 'groups:post', 'Criar posts em grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- social:impact:read
  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES (p_tenant_id, 'social', 'impact:read', 'Visualizar feed de impacto', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- Atribuir permissões às roles padrão (se existirem)
  
  -- OWNER: todas as permissões
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'OWNER'
    AND p.tenant_id = p_tenant_id
    AND p.resource = 'groups'
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

  -- ADMIN: create, read, update
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'ADMIN'
    AND p.tenant_id = p_tenant_id
    AND p.resource = 'groups'
    AND p.action IN ('create', 'read', 'update')
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

  -- USER: read, join, leave
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'USER'
    AND p.tenant_id = p_tenant_id
    AND p.resource = 'groups'
    AND p.action IN ('read', 'join', 'leave')
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

  -- USER: social permissions (read, post, impact)
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'USER'
    AND p.tenant_id = p_tenant_id
    AND p.resource = 'social'
    AND p.action IN ('groups:read', 'groups:feed:read', 'groups:post', 'impact:read')
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

  -- ADMIN: social permissions (tudo)
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  CROSS JOIN permissions p
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'ADMIN'
    AND p.tenant_id = p_tenant_id
    AND p.resource = 'social'
    AND p.action IN ('groups:read', 'groups:feed:read', 'groups:post', 'impact:read')
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- Executar para todos os tenants existentes
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN SELECT tenant_id FROM tenants
  LOOP
    PERFORM seed_groups_permissions(tenant_record.tenant_id);
  END LOOP;
END $$;

