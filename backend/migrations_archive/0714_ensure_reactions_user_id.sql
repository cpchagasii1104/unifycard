-- ============================================================
-- UNIFICARD - MIGRATION 160b (CORRETIVA)
-- Garantir que user_id existe antes da migration 160
-- ============================================================
--
-- Migration corretiva adicional para garantir que a coluna user_id
-- existe na tabela reactions antes da migration 160_create_reactions.sql
-- tentar criar índices que dependem dela.
--
-- CONTEXTO:
-- - Migration 159a pode ter sido executada antes de garantir user_id
-- - Migration 160_create_reactions.sql falha se user_id não existir
-- - Esta migration garante que user_id existe antes da 160
--
-- OBJETIVO:
-- - Verificar se coluna user_id existe na tabela reactions
-- - Adicionar coluna se não existir (idempotente)
-- - Mapear de global_user_id se necessário
--
-- COMPATIBILIDADE:
-- - PROFILE=CORE_ONLY
-- - Idempotente (pode ser executada múltiplas vezes)
-- - Não altera migration 160 (preserva histórico)
--
-- ============================================================

-- Garantir que user_id existe na tabela reactions
DO $$
BEGIN
    -- Verificar se tabela reactions existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reactions'
    ) THEN
        -- Verificar se coluna user_id NÃO existe
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
    END IF;
END $$;

COMMENT ON COLUMN reactions.user_id IS
'Migration 160b: Coluna adicionada para compatibilidade com migration 160. Pode ser NULL para preservar dados antigos.';

