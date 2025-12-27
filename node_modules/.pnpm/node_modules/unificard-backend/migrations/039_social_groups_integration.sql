-- =========================================================
-- 030_social_groups_integration.sql
-- Índices e otimizações para integração Social + Groups
-- =========================================================

-- Índice para buscar posts por groupId (metadata)
CREATE INDEX IF NOT EXISTS idx_posts_metadata_group_id 
ON posts USING GIN ((metadata->>'groupId'));

-- Índice para buscar posts por tipo (auto-posts econômicos)
CREATE INDEX IF NOT EXISTS idx_posts_metadata_type 
ON posts USING GIN ((metadata->>'type'));

-- Índice composto para feed de grupo (groupId + created_at)
CREATE INDEX IF NOT EXISTS idx_posts_group_created 
ON posts ((metadata->>'groupId'), created_at DESC) 
WHERE metadata->>'groupId' IS NOT NULL;

-- Índice para buscar auto-posts econômicos recentes
CREATE INDEX IF NOT EXISTS idx_posts_economic_auto 
ON posts (created_at DESC) 
WHERE metadata->>'type' = 'system_auto_post' 
  AND metadata->>'source' = 'economic_impact';

