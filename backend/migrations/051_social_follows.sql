-- ================================================
-- UNIFICARD - MIGRATION 051
-- Social 2.0 - Sistema de Follows (seguir actors)
-- ================================================

-- ===========================
-- FOLLOWS (seguir actors)
-- ===========================
CREATE TABLE IF NOT EXISTS follows (
  follow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Actor sendo seguido
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  
  -- Actor que está seguindo (follower)
  follower_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Um actor não pode seguir o mesmo actor duas vezes
  CONSTRAINT follows_unique UNIQUE (actor_id, follower_actor_id),
  
  -- Um actor não pode seguir a si mesmo
  CONSTRAINT follows_no_self CHECK (actor_id != follower_actor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_follows_actor ON follows (actor_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_actor_id);
CREATE INDEX IF NOT EXISTS idx_follows_tenant ON follows (tenant_id);
CREATE INDEX IF NOT EXISTS idx_follows_created ON follows (created_at DESC);

-- RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_rls ON follows
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- COMMENTS
-- ===========================
COMMENT ON TABLE follows IS 'Sistema de seguir actors (usuários seguem outros usuários, páginas, grupos)';
















