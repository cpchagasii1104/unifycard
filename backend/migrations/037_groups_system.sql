-- =========================================================
-- 028_groups_system.sql
-- Sistema de Grupos do Unificard
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1) GROUPS (Comunidades/Causas/Projetos)
-- =========================================================

CREATE TABLE groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_user_id UUID NOT NULL, -- global_user_id do criador
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, name)
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_rls ON groups
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_groups_owner ON groups(tenant_id, owner_user_id);
CREATE INDEX idx_groups_active ON groups(tenant_id, is_active) WHERE is_active = true;

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 2) GROUP_MEMBERS (Membros dos grupos)
-- =========================================================

CREATE TYPE group_member_role AS ENUM ('member', 'moderator', 'owner');

CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- global_user_id
  role group_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- RLS: membros podem ver membros do mesmo grupo
CREATE POLICY group_members_rls ON group_members
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.group_id = group_members.group_id
      AND g.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_role ON group_members(group_id, role);

-- =========================================================
-- 3) GROUP_ACCOUNTS (Referência às contas econômicas)
-- =========================================================

CREATE TABLE group_accounts (
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  PRIMARY KEY (group_id, account_id)
);

ALTER TABLE group_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_accounts_rls ON group_accounts
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.group_id = group_accounts.group_id
      AND g.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

CREATE INDEX idx_group_accounts_group ON group_accounts(group_id);
CREATE INDEX idx_group_accounts_account ON group_accounts(account_id);

-- =========================================================
-- 4) Constraint: usuário pode estar em no máximo 3 grupos
-- =========================================================

CREATE OR REPLACE FUNCTION check_user_group_limit()
RETURNS TRIGGER AS $$
DECLARE
  group_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO group_count
  FROM group_members
  WHERE user_id = NEW.user_id;
  
  IF group_count > 3 THEN
    RAISE EXCEPTION 'User cannot be in more than 3 groups';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_user_group_limit
  BEFORE INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION check_user_group_limit();

-- =========================================================
-- 5) Função: transferir ownership automaticamente
-- =========================================================

CREATE OR REPLACE FUNCTION transfer_group_ownership()
RETURNS TRIGGER AS $$
BEGIN
  -- Se owner está saindo, promover moderador mais antigo
  IF OLD.role = 'owner' AND NEW.role IS NULL THEN
    UPDATE group_members
    SET role = 'owner'
    WHERE group_id = OLD.group_id
    AND user_id != OLD.user_id
    AND role = 'moderator'
    ORDER BY joined_at ASC
    LIMIT 1;
    
    -- Se não houver moderador, promover membro mais antigo
    IF NOT FOUND THEN
      UPDATE group_members
      SET role = 'owner'
      WHERE group_id = OLD.group_id
      AND user_id != OLD.user_id
      ORDER BY joined_at ASC
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transfer_group_ownership
  AFTER DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION transfer_group_ownership();

