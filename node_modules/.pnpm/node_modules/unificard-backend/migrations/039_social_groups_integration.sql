-- ============================================================
-- UNIFICARD — MIGRATION 039
-- Arquivo: 039_social_groups_integration.sql
-- Tipo: OTIMIZAÇÃO DE ÍNDICES (Social + Groups)
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Otimizar queries do feed social relacionadas a grupos,
-- especialmente:
-- • feed de posts por groupId
-- • auto-posts econômicos gerados pelo sistema
--
-- ESCOPO
-- ✔ Cria índices de leitura para posts com metadata de grupos
-- ✔ Não altera schema nem dados
--
-- ❌ Não cria tabelas
-- ❌ Não altera permissões
--
-- DEPENDÊNCIAS
-- • posts (com colunas: tenant_id, metadata, created_at)
--
-- PADRÕES APLICADOS
-- • Índices BTREE para expressões escalares (metadata->>'x')
-- • tenant_id sempre como primeiro componente
-- • Partial indexes para feeds específicos
--
-- ============================================================

-- ============================================================
-- 1) FEED DE POSTS POR GRUPO
-- Query alvo:
--   WHERE tenant_id = ?
--     AND metadata->>'groupId' = ?
--   ORDER BY created_at DESC
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_posts_tenant_group_created
ON posts (
  tenant_id,
  (metadata->>'groupId'),
  created_at DESC
)
WHERE metadata->>'groupId' IS NOT NULL;

COMMENT ON INDEX idx_posts_tenant_group_created IS
  'Feed de posts por grupo (tenant + groupId), ordenado por data';

-- ============================================================
-- 2) AUTO-POSTS ECONÔMICOS DO SISTEMA
-- Query alvo:
--   WHERE tenant_id = ?
--     AND metadata->>''type'' = ''system_auto_post''
--     AND metadata->>''source'' = ''economic_impact''
--   ORDER BY created_at DESC
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_posts_tenant_economic_auto
ON posts (
  tenant_id,
  created_at DESC
)
WHERE metadata->>'type' = 'system_auto_post'
  AND metadata->>'source' = 'economic_impact';

COMMENT ON INDEX idx_posts_tenant_economic_auto IS
  'Auto-posts econômicos recentes por tenant';

-- ============================================================
-- FIM 039_social_groups_integration.sql
-- ============================================================
