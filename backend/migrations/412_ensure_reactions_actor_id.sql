-- ============================================================
-- UNIFICARD - MIGRATION 160b (CORRETIVA)
-- Garantir que actor_id existe antes da migration 160
-- ============================================================
--
-- Migration corretiva adicional para garantir que a coluna actor_id
-- existe na tabela reactions antes da migration 160_create_reactions.sql
-- tentar criar índices que dependem dela.
--
-- CONTEXTO:
-- - Migration 159b pode ter sido executada antes de garantir actor_id
-- - Migration 160_create_reactions.sql falha se actor_id não existir
-- - Esta migration garante que actor_id existe antes da 160
--
-- OBJETIVO:
-- - Verificar se coluna actor_id existe na tabela reactions
-- - Adicionar coluna se não existir (idempotente)
--
-- COMPATIBILIDADE:
-- - PROFILE=CORE_ONLY
-- - Idempotente (pode ser executada múltiplas vezes)
-- - Não altera migration 160 (preserva histórico)
--
-- ============================================================

-- Garantir que actor_id existe na tabela reactions
DO $$
BEGIN
    -- Verificar se tabela reactions existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reactions'
    ) THEN
        -- Verificar se coluna actor_id NÃO existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reactions' 
            AND column_name = 'actor_id'
        ) THEN
            -- Adicionar actor_id como nullable (migration 160 espera isso)
            ALTER TABLE reactions 
            ADD COLUMN actor_id UUID;
        END IF;
    END IF;
END $$;

COMMENT ON COLUMN reactions.actor_id IS
'Migration 160b: Coluna adicionada para compatibilidade com migration 160. Pode ser NULL.';

