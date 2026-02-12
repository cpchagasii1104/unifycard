/*
Arquivo: 022_global_identity.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Sistema de Identidade Global (UnifyCard ID)

Objetivo:
- Criar uma identidade global única para usuários
- Permitir vincular usuários locais (tenant) a uma identidade global
- Facilitar cross-tenant, reputação e histórico unificado

Dependências:
- users (001_initial_schema.sql)
- tenants (001_initial_schema.sql)
- extensão pgcrypto
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- GLOBAL USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS global_users (
  global_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name TEXT,
  avatar_url TEXT,
  birthdate DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_users_created_at
  ON global_users (created_at);

-- updated_at padrão do projeto
DROP TRIGGER IF EXISTS trg_global_users_updated_at ON global_users;
CREATE TRIGGER trg_global_users_updated_at
  BEFORE UPDATE ON global_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- USER IDENTITY LINKS
-- =========================================================

CREATE TABLE IF NOT EXISTS user_identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- um usuário local em um tenant só pode apontar para um global
  UNIQUE (user_id, tenant_id),

  -- evita duplicação explícita do mesmo vínculo
  UNIQUE (global_user_id, user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identity_links_global_user
  ON user_identity_links (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_identity_links_user_tenant
  ON user_identity_links (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_identity_links_tenant
  ON user_identity_links (tenant_id);

-- =========================================================
-- ADD GLOBAL_USER_ID TO USERS (OPCIONAL / COMPATIBILIDADE)
-- =========================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS global_user_id UUID
  REFERENCES global_users(global_user_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_global_user_id
  ON users (global_user_id)
  WHERE global_user_id IS NOT NULL;

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON TABLE global_users IS
  'Identidade global do usuário (UnifyCard ID), válida em todo o sistema';

COMMENT ON TABLE user_identity_links IS
  'Ligação entre usuários locais (tenant) e identidade global';

COMMENT ON COLUMN users.global_user_id IS
  'Referência direta opcional à identidade global (compatibilidade e lookup rápido)';

COMMENT ON COLUMN global_users.metadata IS
  'Metadados adicionais do perfil global (JSONB)';








