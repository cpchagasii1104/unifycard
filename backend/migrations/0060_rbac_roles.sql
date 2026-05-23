-- ============================================================
-- 0060: RBAC mínimo — roles, permissions, user_roles, role_permissions
-- ============================================================
-- Origem conceitual: migrations_archive/0075_rbac.sql (adaptado).
-- Dependências: 0001_extensions (uuid), 0002_identity (tenants), 0058 (users.id).
-- Objetivo: permitir seeds e serviços core/rbac que consultam estas tabelas.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
  role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roles_tenant_name_key UNIQUE (tenant_id, name)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'roles'
      AND policyname = 'roles_rls'
  ) THEN
    CREATE POLICY roles_rls ON roles
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX idx_roles_tenant ON roles (tenant_id);
CREATE INDEX idx_roles_tenant_name ON roles (tenant_id, name);

-- ---------------------------------------------------------------------------
-- PERMISSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE permissions (
  permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_permission BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permissions_tenant_resource_action_key UNIQUE (tenant_id, resource, action)
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'permissions'
      AND policyname = 'permissions_rls'
  ) THEN
    CREATE POLICY permissions_rls ON permissions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX idx_permissions_tenant ON permissions (tenant_id);
CREATE INDEX idx_permissions_tenant_resource_action ON permissions (tenant_id, resource, action);

-- ---------------------------------------------------------------------------
-- USER_ROLES
-- ---------------------------------------------------------------------------
CREATE TABLE user_roles (
  user_role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles (role_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT user_roles_tenant_user_role_key UNIQUE (tenant_id, user_id, role_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'user_roles'
      AND policyname = 'user_roles_rls'
  ) THEN
    CREATE POLICY user_roles_rls ON user_roles
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX idx_user_roles_tenant_user ON user_roles (tenant_id, user_id);
CREATE INDEX idx_user_roles_tenant_role ON user_roles (tenant_id, role_id);

-- ---------------------------------------------------------------------------
-- ROLE_PERMISSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE role_permissions (
  role_permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles (role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions (permission_id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT role_permissions_tenant_role_permission_key UNIQUE (tenant_id, role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'role_permissions'
      AND policyname = 'role_permissions_rls'
  ) THEN
    CREATE POLICY role_permissions_rls ON role_permissions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX idx_role_permissions_tenant_role ON role_permissions (tenant_id, role_id);
CREATE INDEX idx_role_permissions_tenant_permission ON role_permissions (tenant_id, permission_id);

-- ---------------------------------------------------------------------------
-- FUNÇÕES (bootstrap mínimo para seed_default_rbac)
-- ---------------------------------------------------------------------------
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
  ON CONFLICT ON CONSTRAINT roles_tenant_name_key DO UPDATE
    SET description = EXCLUDED.description,
        updated_at = now()
  RETURNING role_id INTO v_role_id;

  IF v_role_id IS NULL THEN
    SELECT role_id
      INTO v_role_id
      FROM roles
      WHERE tenant_id = p_tenant_id
        AND name = p_role_name
      LIMIT 1;
  END IF;

  FOREACH v_perm IN ARRAY p_permissions LOOP
    v_resource := split_part(v_perm, ':', 1);
    v_action   := split_part(v_perm, ':', 2);

    INSERT INTO permissions (tenant_id, resource, action, is_system_permission)
    VALUES (p_tenant_id, v_resource, v_action, true)
    ON CONFLICT ON CONSTRAINT permissions_tenant_resource_action_key DO UPDATE
      SET updated_at = now()
    RETURNING permission_id INTO v_permission_id;

    INSERT INTO role_permissions (tenant_id, role_id, permission_id)
    VALUES (p_tenant_id, v_role_id, v_permission_id)
    ON CONFLICT ON CONSTRAINT role_permissions_tenant_role_permission_key DO NOTHING;
  END LOOP;

  RETURN v_role_id;
END;
$$ LANGUAGE plpgsql;

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
    JOIN role_permissions rp ON ur.role_id = rp.role_id AND ur.tenant_id = rp.tenant_id
    JOIN permissions p ON rp.permission_id = p.permission_id AND p.tenant_id = rp.tenant_id
    WHERE ur.tenant_id = p_tenant_id
      AND ur.user_id = p_user_id
      AND p.resource = p_resource
      AND p.action = p_action
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_permissions(
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  permission_id UUID,
  tenant_id UUID,
  resource VARCHAR,
  action VARCHAR,
  description TEXT,
  is_system_permission BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
  JOIN role_permissions rp ON ur.role_id = rp.role_id AND ur.tenant_id = rp.tenant_id
  JOIN permissions p ON rp.permission_id = p.permission_id AND p.tenant_id = rp.tenant_id
  WHERE ur.tenant_id = p_tenant_id
    AND ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION seed_default_rbac(
  p_tenant_id UUID
) RETURNS VOID AS $$
BEGIN
  PERFORM create_role_with_permissions(
    p_tenant_id,
    'admin',
    'Administrator with full access',
    ARRAY[
      'accounts:create','accounts:read','accounts:update','accounts:delete','accounts:list',
      'transactions:create','transactions:read','transactions:list','transactions:cancel',
      'ledger:read','ledger:list','ledger:audit',
      'distribution:create','distribution:read','distribution:update','distribution:delete','distribution:execute',
      'users:create','users:read','users:update','users:delete','users:list',
      'roles:create','roles:read','roles:update','roles:delete','roles:assign',
      'permissions:create','permissions:read','permissions:update','permissions:delete',
      'system:config','system:metrics',
      'notify:enqueue','notify:read','notify:retry','notify:process','notify:manage'
    ]
  );

  PERFORM create_role_with_permissions(
    p_tenant_id,
    'user',
    'Basic user',
    ARRAY[
      'accounts:read','accounts:list',
      'transactions:create','transactions:read','transactions:list',
      'ledger:read','ledger:list'
    ]
  );

  PERFORM create_role_with_permissions(
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

  PERFORM create_role_with_permissions(
    p_tenant_id,
    'manager',
    'Manager with elevated permissions',
    ARRAY[
      'accounts:read','accounts:list','accounts:create',
      'transactions:read','transactions:list',
      'ledger:read','ledger:list','ledger:audit',
      'distribution:create','distribution:read','distribution:update','distribution:execute',
      'users:read','users:list',
      'notify:read'
    ]
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE roles IS 'RBAC roles por tenant';
COMMENT ON TABLE permissions IS 'RBAC permissions (resource:action)';
COMMENT ON TABLE user_roles IS 'User <-> Role many-to-many';
COMMENT ON TABLE role_permissions IS 'Role <-> Permission many-to-many';

COMMIT;
