-- ================================================
-- UNIFICARD - MIGRATION 002 - RBAC (FINAL)
-- COMPLETA + MULTITENANT + RLS + NOTIFY
-- ================================================

-- ===========================
-- ROLES
-- ===========================
CREATE TABLE roles (
  role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_rls ON roles
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_roles_tenant ON roles(tenant_id);
CREATE INDEX idx_roles_name ON roles(tenant_id, name);

-- ===========================
-- PERMISSIONS
-- ===========================
CREATE TABLE permissions (
  permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_permission BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(tenant_id, resource, action)
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_rls ON permissions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_permissions_tenant ON permissions(tenant_id);
CREATE INDEX idx_permissions_resource_action ON permissions(tenant_id, resource, action);

-- ===========================
-- USER_ROLES
-- ===========================
CREATE TABLE user_roles (
  user_role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT now(),
  assigned_by UUID REFERENCES users(user_id),
  UNIQUE(tenant_id, user_id, role_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_rls ON user_roles
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_user_roles_user ON user_roles(tenant_id, user_id);
CREATE INDEX idx_user_roles_role ON user_roles(tenant_id, role_id);

-- ===========================
-- ROLE_PERMISSIONS
-- ===========================
CREATE TABLE role_permissions (
  role_permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT now(),
  granted_by UUID REFERENCES users(user_id),
  UNIQUE(tenant_id, role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_rls ON role_permissions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_role_permissions_role ON role_permissions(tenant_id, role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(tenant_id, permission_id);

-- ===========================
-- FUNCTION: create_role_with_permissions
-- ===========================
CREATE OR REPLACE FUNCTION create_role_with_permissions(
  p_tenant_id UUID,
  p_role_name VARCHAR,
  p_role_description TEXT,
  p_permissions TEXT[] 
) RETURNS UUID AS $$
DECLARE
  v_role_id UUID;
  v_permission_id UUID;
  v_resource VARCHAR;
  v_action VARCHAR;
  v_perm TEXT;
BEGIN
  INSERT INTO roles (tenant_id, name, description, is_system_role)
  VALUES (p_tenant_id, p_role_name, p_role_description, true)
  RETURNING role_id INTO v_role_id;

  FOREACH v_perm IN ARRAY p_permissions
  LOOP
    v_resource := split_part(v_perm, ':', 1);
    v_action := split_part(v_perm, ':', 2);

    INSERT INTO permissions (tenant_id, resource, action, is_system_permission)
    VALUES (p_tenant_id, v_resource, v_action, true)
    ON CONFLICT (tenant_id, resource, action) DO UPDATE SET
      resource = EXCLUDED.resource
    RETURNING permission_id INTO v_permission_id;

    INSERT INTO role_permissions (tenant_id, role_id, permission_id)
    VALUES (p_tenant_id, v_role_id, v_permission_id);
  END LOOP;

  RETURN v_role_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- FUNCTION: user_has_permission
-- ===========================
CREATE OR REPLACE FUNCTION user_has_permission(
  p_tenant_id UUID,
  p_user_id UUID,
  p_resource VARCHAR,
  p_action VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.permission_id
    WHERE ur.tenant_id = p_tenant_id
      AND ur.user_id = p_user_id
      AND p.resource = p_resource
      AND p.action = p_action
  );
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- FUNCTION: get_user_permissions
-- ===========================
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_tenant_id UUID,
  p_user_id UUID
) 
RETURNS TABLE(
  permission_id UUID,
  tenant_id UUID,
  resource VARCHAR,
  action VARCHAR,
  description TEXT,
  is_system_permission BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    p.permission_id,
    p.tenant_id,
    p.resource,
    p.action,
    p.description,
    p.is_system_permission,
    p.created_at,
    p.updated_at
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.permission_id
  WHERE ur.tenant_id = p_tenant_id
    AND ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- SEED: Default RBAC
-- ===========================
CREATE OR REPLACE FUNCTION seed_default_rbac(p_tenant_id UUID) RETURNS VOID AS $$
DECLARE
  v_admin_role_id UUID;
  v_user_role_id UUID;
  v_merchant_role_id UUID;
  v_manager_role_id UUID;
BEGIN

  -- ===========================================================
  -- ROLE: ADMIN
  -- ===========================================================
  v_admin_role_id := create_role_with_permissions(
    p_tenant_id,
    'admin',
    'Administrator with full access',
    ARRAY[
      -- Accounts
      'accounts:create','accounts:read','accounts:update','accounts:delete','accounts:list',

      -- Transactions
      'transactions:create','transactions:read','transactions:list','transactions:cancel',

      -- Ledger
      'ledger:read','ledger:list','ledger:audit',

      -- Distribution
      'distribution:create','distribution:read','distribution:update','distribution:delete','distribution:execute',

      -- Users
      'users:create','users:read','users:update','users:delete','users:list',

      -- RBAC
      'roles:create','roles:read','roles:update','roles:delete','roles:assign',
      'permissions:create','permissions:read','permissions:update','permissions:delete',

      -- System
      'system:config','system:metrics',

      -- =======================================
      -- NOTIFY (NOVO)
      -- =======================================
      'notify:enqueue',
      'notify:read',
      'notify:retry',
      'notify:process',
      'notify:manage'
    ]
  );

  -- ===========================
  -- ROLE: USER
  -- ===========================
  v_user_role_id := create_role_with_permissions(
    p_tenant_id,
    'user',
    'Basic user',
    ARRAY[
      'accounts:read','accounts:list',
      'transactions:create','transactions:read','transactions:list',
      'ledger:read','ledger:list'
    ]
  );

  -- ===========================
  -- ROLE: MERCHANT
  -- ===========================
  v_merchant_role_id := create_role_with_permissions(
    p_tenant_id,
    'merchant',
    'Merchant with basic business access',
    ARRAY[
      'accounts:read','accounts:list',
      'transactions:create','transactions:read','transactions:list',
      'ledger:read','ledger:list',
      'distribution:read'
    ]
  );

  -- ===========================
  -- ROLE: MANAGER
  -- ===========================
  v_manager_role_id := create_role_with_permissions(
    p_tenant_id,
    'manager',
    'Manager with elevated permissions',
    ARRAY[
      'accounts:read','accounts:list','accounts:create',
      'transactions:read','transactions:list',
      'ledger:read','ledger:list','ledger:audit',
      'distribution:create','distribution:read','distribution:update','distribution:execute',
      'users:read','users:list',

      -- Pode ver notificações
      'notify:read'
    ]
  );

END;
$$ LANGUAGE plpgsql;

-- Docs
COMMENT ON TABLE roles IS 'RBAC roles';
COMMENT ON TABLE permissions IS 'RBAC permissions (resource/action)';
COMMENT ON TABLE user_roles IS 'User <-> Role many-to-many';
COMMENT ON TABLE role_permissions IS 'Role <-> Permission many-to-many';

COMMENT ON FUNCTION create_role_with_permissions IS 'Helper function to create role + permissions';
COMMENT ON FUNCTION user_has_permission IS 'Checks if a user has a specific permission';
COMMENT ON FUNCTION get_user_permissions IS 'Returns all permissions of a user';
COMMENT ON FUNCTION seed_default_rbac IS 'Seeds roles and permissions for a tenant';