-- ============================================================
-- UNIFICARD - MIGRATION 300
-- FASE 5: Tornar created_by_global_user_id NULLable
-- ============================================================
--
-- CONTEXTO:
-- A migration 026 criou a tabela events com created_by_global_user_id
-- como NOT NULL. No modelo FASE 5, o responsável é identificado por
-- actor_id + actor_type, não por global_user_id.
--
-- REFERÊNCIA (migration 090):
-- "O campo created_by_global_user_id:
--  - não deve ser usado como responsabilidade institucional
--  - não deve ser inferido como ator responsável
--  - permanece apenas para compatibilidade histórica"
--
-- SOLUÇÃO:
-- Tornar created_by_global_user_id NULLable para permitir criação de
-- eventos via FASE 5 que usam actor_id como identificador principal.
--
-- CONFORMIDADE:
-- - EVENT_DOMAIN_MINIMUM_CONTRACT: actor_id é o identificador canônico
-- - LEGADO_TEMPORAL_MIGRATION_PLAN: mantém compatibilidade com legado
-- ============================================================

-- 1. Tornar coluna NULLable
ALTER TABLE events
ALTER COLUMN created_by_global_user_id DROP NOT NULL;

-- 2. Comentário para documentação
COMMENT ON COLUMN events.created_by_global_user_id IS
  'LEGADO: ID do usuário global que criou. Nullable para FASE 5. Usar actor_id preferencialmente.';
