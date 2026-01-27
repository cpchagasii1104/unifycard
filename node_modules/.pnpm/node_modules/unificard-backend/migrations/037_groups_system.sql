-- ============================================================
-- UNIFICARD — MIGRATION 037
-- Arquivo: 037_groups_system.sql
-- Sistema de Grupos (Comunidades / Causas / Projetos)
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Implementar sistema de grupos multi-tenant com:
-- • ownership explícito
-- • controle de membros e papéis
-- • isolamento por tenant via RLS
-- • limite de participação por usuário
--
-- ESCOPO
-- ✔ Cria tabelas groups, group_members, group_accounts
-- ✔ Cria enum de papéis
-- ✔ Aplica RLS seguro
-- ✔ Aplica regras de negócio via triggers
--
-- ❌ Não remove dados
-- ❌ Não altera schemas existentes
--
-- DEPENDÊNCIAS
-- • tenants
-- • accounts
-- • função update_updated_at_column()
-- • extensão uuid-ossp
--
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1) GROUPS
-- ============================================================

CREATE TABLE IF NOT EXISTS groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_user_id UUID NOT NULL, -- global_user_id
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name)
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_rls ON groups
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX IF NOT EXISTS idx_groups_tenant ON groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(tenant_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(tenant_id, is_active)
  WHERE is_active = true;

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2) GROUP MEMBERS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'group_member_role'
  ) THEN
    CREATE TYPE group_member_role AS ENUM ('member', 'moderator', 'owner');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL, -- global_user_id
  role group_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Membro só vê grupos onde participa
CREATE POLICY group_members_rls ON group_members
  USING (
    tenant_id::text = current_setting('app.current_tenant', true)
    AND EXISTS (
      SELECT 1
      FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id::text = current_setting('app.current_user', true)
    )
  );

CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON group_members(group_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user
  ON group_members(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_group_members_role
  ON group_members(group_id, role);

-- ============================================================
-- 3) GROUP ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS group_accounts (
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (group_id, account_id)
);

ALTER TABLE group_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_accounts_rls ON group_accounts
  USING (
    tenant_id::text = current_setting('app.current_tenant', true)
    AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_accounts.group_id
        AND gm.user_id::text = current_setting('app.current_user', true)
    )
  );

CREATE INDEX IF NOT EXISTS idx_group_accounts_group
  ON group_accounts(group_id);

CREATE INDEX IF NOT EXISTS idx_group_accounts_account
  ON group_accounts(account_id);

-- ============================================================
-- 4) LIMITE DE 3 GRUPOS POR USUÁRIO (POR TENANT)
-- ============================================================

CREATE OR REPLACE FUNCTION check_user_group_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  group_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO group_count
  FROM group_members
  WHERE tenant_id = NEW.tenant_id
    AND user_id = NEW.user_id;

  IF group_count >= 3 THEN
    RAISE EXCEPTION
      'User % cannot be in more than 3 groups in this tenant',
      NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_user_group_limit
  BEFORE INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION check_user_group_limit();

-- ============================================================
-- 5) TRANSFERÊNCIA AUTOMÁTICA DE OWNERSHIP
-- ============================================================

CREATE OR REPLACE FUNCTION transfer_group_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_new_owner UUID;
BEGIN
  -- só executa se quem saiu era owner
  IF OLD.role <> 'owner' THEN
    RETURN OLD;
  END IF;

  -- tenta moderador mais antigo
  SELECT user_id INTO v_new_owner
  FROM group_members
  WHERE group_id = OLD.group_id
    AND role = 'moderator'
  ORDER BY joined_at ASC
  LIMIT 1;

  -- fallback: membro mais antigo
  IF v_new_owner IS NULL THEN
    SELECT user_id INTO v_new_owner
    FROM group_members
    WHERE group_id = OLD.group_id
    ORDER BY joined_at ASC
    LIMIT 1;
  END IF;

  IF v_new_owner IS NOT NULL THEN
    UPDATE group_members
    SET role = 'owner'
    WHERE group_id = OLD.group_id
      AND user_id = v_new_owner;

    UPDATE groups
    SET owner_user_id = v_new_owner
    WHERE group_id = OLD.group_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_transfer_group_ownership
  AFTER DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION transfer_group_ownership();

-- ============================================================
-- FIM 037_groups_system.sql
-- ============================================================
