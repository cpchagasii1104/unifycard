-- migrations/121_group_invites.sql
-- Tabela de convites para grupos

-- Criar tabela group_invites
CREATE TABLE IF NOT EXISTS group_invites (
  invite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  group_id UUID NOT NULL,
  invited_user_id TEXT NOT NULL, -- global_user_id do usuário convidado
  invited_by_user_id TEXT NOT NULL, -- global_user_id de quem convidou
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_group_invites_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
  CONSTRAINT fk_group_invites_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);


-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_invited_user_id ON group_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_status ON group_invites(status);
CREATE INDEX IF NOT EXISTS idx_group_invites_tenant_id ON group_invites(tenant_id);

-- Índice parcial único para evitar convites duplicados pendentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_invites_unique_pending 
  ON group_invites(group_id, invited_user_id) 
  WHERE status = 'pending';

-- Comentários para documentação
COMMENT ON TABLE group_invites IS 'Convites para participar de grupos';
COMMENT ON COLUMN group_invites.invite_id IS 'ID único do convite';
COMMENT ON COLUMN group_invites.tenant_id IS 'ID do tenant (multi-tenant)';
COMMENT ON COLUMN group_invites.group_id IS 'ID do grupo';
COMMENT ON COLUMN group_invites.invited_user_id IS 'ID do usuário convidado (global_user_id)';
COMMENT ON COLUMN group_invites.invited_by_user_id IS 'ID de quem enviou o convite (global_user_id)';
COMMENT ON COLUMN group_invites.status IS 'Status do convite: pending, accepted, declined';
COMMENT ON COLUMN group_invites.created_at IS 'Data de criação do convite';
COMMENT ON COLUMN group_invites.updated_at IS 'Data de última atualização';

