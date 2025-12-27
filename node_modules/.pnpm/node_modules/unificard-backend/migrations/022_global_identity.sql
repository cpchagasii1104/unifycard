-- ================================================
-- UNIFICARD - MIGRATION 022
-- Sistema de Identidade Global (UnifyCard ID)
-- ================================================

-- ===========================
-- GLOBAL USERS
-- ===========================
CREATE TABLE IF NOT EXISTS global_users (
  global_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name TEXT,
  avatar_url TEXT,
  birthdate DATE,
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_global_users_created_at ON global_users (created_at);

-- ===========================
-- USER IDENTITY LINKS
-- ===========================
CREATE TABLE IF NOT EXISTS user_identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identity_links_global_user ON user_identity_links (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_identity_links_user_tenant ON user_identity_links (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_identity_links_tenant ON user_identity_links (tenant_id);

-- ===========================
-- ADD GLOBAL_USER_ID TO USERS
-- ===========================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_global_user_id ON users (global_user_id) WHERE global_user_id IS NOT NULL;

-- ===========================
-- TRIGGER PARA UPDATED_AT
-- ===========================
CREATE OR REPLACE FUNCTION update_global_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_global_users_updated_at
  BEFORE UPDATE ON global_users
  FOR EACH ROW
  EXECUTE FUNCTION update_global_users_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE global_users IS 'Identidade global do usuário (UnifyCard ID) - válida em todo o sistema';
COMMENT ON TABLE user_identity_links IS 'Ligações entre usuários locais (tenant) e identidade global';
COMMENT ON COLUMN users.global_user_id IS 'Referência direta à identidade global (opcional, mantida para compatibilidade)';
COMMENT ON COLUMN global_users.metadata IS 'Dados adicionais do perfil global (JSONB)';








