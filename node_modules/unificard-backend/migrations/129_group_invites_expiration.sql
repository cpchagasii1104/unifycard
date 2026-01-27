-- migrations/123_group_invites_expiration.sql
-- Adiciona campos de expiração aos convites de grupo

-- Adicionar coluna expires_at
ALTER TABLE group_invites
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Atualizar constraint de status para incluir 'expired'
ALTER TABLE group_invites
DROP CONSTRAINT IF EXISTS group_invites_status_check;

ALTER TABLE group_invites
ADD CONSTRAINT group_invites_status_check 
CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));

-- Criar índice para expires_at para queries de expiração
CREATE INDEX IF NOT EXISTS idx_group_invites_expires_at 
ON group_invites(expires_at) 
WHERE expires_at IS NOT NULL;

-- Atualizar índice único para incluir apenas convites pendentes
-- NOTA: Removemos a verificação de expiração do índice porque now() não é IMMUTABLE
-- A aplicação deve validar expiração antes de aceitar/rejeitar convites
DROP INDEX IF EXISTS idx_group_invites_unique_pending;

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_invites_unique_pending
ON group_invites(group_id, invited_user_id)
WHERE status = 'pending';

-- Comentários para documentação
COMMENT ON COLUMN group_invites.expires_at IS 'Data de expiração do convite (UTC). Se NULL, o convite não expira.';
COMMENT ON COLUMN group_invites.status IS 'Status do convite: pending, accepted, declined, expired';





