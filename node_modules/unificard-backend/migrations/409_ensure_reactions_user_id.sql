-- ============================================================
-- UNIFICARD - MIGRATION 159b (CORRETIVA)
-- Garantir que user_id e actor_id existem antes da migration 160
-- ============================================================
--
-- Migration corretiva adicional para garantir que as colunas user_id e actor_id
-- existem na tabela reactions antes da migration 160_create_reactions.sql
-- tentar criar índices que dependem delas.
--
-- CONTEXTO:
-- - Migration 159a pode ter sido executada antes de garantir user_id/actor_id
-- - Migration 160_create_reactions.sql falha se user_id ou actor_id não existirem
-- - Esta migration garante que ambas existem antes da 160
--
-- OBJETIVO:
-- - Verificar se colunas user_id e actor_id existem na tabela reactions
-- - Adicionar colunas se não existirem (idempotente)
-- - Mapear de global_user_id se necessário
--
-- COMPATIBILIDADE:
-- - PROFILE=CORE_ONLY
-- - Idempotente (pode ser executada múltiplas vezes)
-- - Não altera migration 160 (preserva histórico)
--
-- ============================================================

-- Garantir que user_id e actor_id existem na tabela reactions
DO $$
BEGIN
    -- Verificar se tabela reactions existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reactions'
    ) THEN
        -- PASSO 1: Verificar se coluna user_id NÃO existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reactions' 
            AND column_name = 'user_id'
        ) THEN
            -- Verificar se existe global_user_id para mapear
            IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'reactions' 
                AND column_name = 'global_user_id'
            ) THEN
                -- Adicionar user_id e copiar valores de global_user_id
                ALTER TABLE reactions 
                ADD COLUMN user_id UUID;
                
                -- Copiar valores de global_user_id para user_id
                UPDATE reactions 
                SET user_id = global_user_id 
                WHERE user_id IS NULL;
            ELSE
                -- Apenas adicionar como nullable
                ALTER TABLE reactions 
                ADD COLUMN user_id UUID;
            END IF;
        END IF;
        
        -- PASSO 2: Verificar se coluna actor_id NÃO existe
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

COMMENT ON COLUMN reactions.user_id IS
'Migration 159b: Coluna adicionada para compatibilidade com migration 160. Pode ser NULL para preservar dados antigos.';

COMMENT ON COLUMN reactions.actor_id IS
'Migration 159b: Coluna adicionada para compatibilidade com migration 160. Pode ser NULL.';

