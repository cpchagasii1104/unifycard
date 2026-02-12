-- ============================================================
-- UNIFICARD - MIGRATION 161 (CORRETIVA)
-- Correção: reactions entity_type dependency
-- ============================================================
--
-- Migration corretiva criada devido à falha da 160_create_reactions.sql
-- por dependência ausente da coluna entity_type.
--
-- CONTEXTO:
-- - Migration 050_social_2_0.sql criou tabela reactions com estrutura diferente
-- - Migration 160_create_reactions.sql tenta criar nova estrutura com entity_type
-- - Como tabela já existe (CREATE TABLE IF NOT EXISTS), coluna entity_type não foi criada
-- - Índices e constraints que dependem de entity_type falham
--
-- OBJETIVO:
-- - Verificar se coluna entity_type existe na tabela reactions
-- - Adicionar coluna se não existir (idempotente)
-- - Ajustar estrutura para compatibilidade com migration 160
-- - Preservar dados existentes se houver
--
-- COMPATIBILIDADE:
-- - PROFILE=CORE_ONLY
-- - Idempotente (pode ser executada múltiplas vezes)
-- - Não altera migration 160 (preserva histórico)
--
-- ============================================================

-- Verificar se tabela reactions existe e ajustar estrutura
DO $$
BEGIN
    -- Verificar se tabela reactions existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reactions'
    ) THEN
        -- PASSO 1: Adicionar coluna user_id se não existir (migration 160 espera user_id)
        -- IMPORTANTE: Esta verificação deve ocorrer PRIMEIRO, independentemente de entity_type
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
        
        -- PASSO 2: Verificar se coluna entity_type NÃO existe
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reactions' 
            AND column_name = 'entity_type'
        ) THEN
            -- Adicionar coluna entity_type
            -- Se houver dados antigos com post_id, podemos migrar ou deixar NULL
            -- Por enquanto, adicionamos como nullable para não quebrar dados existentes
            ALTER TABLE reactions 
            ADD COLUMN entity_type VARCHAR(50) 
            CHECK (entity_type IS NULL OR entity_type IN ('event', 'post', 'group', 'channel'));
            
            -- Adicionar coluna entity_id se não existir
            IF NOT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'reactions' 
                AND column_name = 'entity_id'
            ) THEN
                ALTER TABLE reactions 
                ADD COLUMN entity_id UUID;
            END IF;
        END IF;
        
        -- Se entity_type foi adicionada acima, continuar com ajustes
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reactions' 
            AND column_name = 'entity_type'
        ) THEN
            
            -- Se existir post_id, podemos migrar dados (opcional, preservar compatibilidade)
            -- Por enquanto, apenas adicionamos as colunas
            
            -- Tornar entity_type NOT NULL apenas se não houver dados antigos
            -- Ou criar constraint condicional
            -- Por segurança, mantemos nullable inicialmente
        END IF;
        
        -- Verificar se constraint unique_user_entity_reaction existe
        -- Se não existir e entity_type existir, criar
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reactions' 
            AND column_name = 'entity_type'
        ) THEN
            -- Remover constraint antiga se existir (pode ter nome diferente)
            IF EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints 
                WHERE table_schema = 'public' 
                AND table_name = 'reactions' 
                AND constraint_name = 'reactions_unique_user_post'
            ) THEN
                ALTER TABLE reactions 
                DROP CONSTRAINT IF EXISTS reactions_unique_user_post;
            END IF;
            
            -- Criar constraint nova se não existir e user_id existir
            -- Migration 160 espera user_id, então usamos user_id se existir
            IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'reactions' 
                AND column_name = 'user_id'
            ) AND NOT EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints 
                WHERE table_schema = 'public' 
                AND table_name = 'reactions' 
                AND constraint_name = 'unique_user_entity_reaction'
            ) THEN
                -- Criar constraint usando user_id (migration 160 espera isso)
                ALTER TABLE reactions 
                ADD CONSTRAINT unique_user_entity_reaction 
                UNIQUE (entity_type, entity_id, user_id)
                DEFERRABLE INITIALLY DEFERRED;
            END IF;
        END IF;
        
        -- Criar índices que dependem de entity_type (idempotente)
        -- Usar EXECUTE para criar índices condicionalmente
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'reactions' 
            AND column_name = 'entity_type'
        ) THEN
            -- Criar índices apenas se entity_type existir
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'reactions' 
                AND indexname = 'idx_reactions_entity'
            ) THEN
                CREATE INDEX idx_reactions_entity
                    ON reactions(entity_type, entity_id)
                    WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'reactions' 
                AND indexname = 'idx_reactions_aggregation'
            ) THEN
                CREATE INDEX idx_reactions_aggregation
                    ON reactions(entity_type, entity_id, reaction_type)
                    WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
            END IF;
        END IF;
    END IF;
END $$;

-- Verificar se tabela reaction_counts existe e possui estrutura correta
DO $$
BEGIN
    -- Se tabela não existir, criar (conforme migration 160)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'reaction_counts'
    ) THEN
        CREATE TABLE reaction_counts (
            entity_type VARCHAR(50) NOT NULL,
            entity_id UUID NOT NULL,
            tenant_id UUID NOT NULL
                REFERENCES tenants(tenant_id)
                ON DELETE CASCADE,
            reaction_type VARCHAR(50) NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (entity_type, entity_id, reaction_type)
        );
        
        CREATE INDEX IF NOT EXISTS idx_reaction_counts_entity
            ON reaction_counts(entity_type, entity_id);
        
        CREATE INDEX IF NOT EXISTS idx_reaction_counts_tenant
            ON reaction_counts(tenant_id);
    END IF;
END $$;

-- Verificar se função update_reaction_count existe
-- Se não existir, criar (conforme migration 160)
CREATE OR REPLACE FUNCTION update_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Apenas processar se entity_type e entity_id não forem NULL
    IF TG_OP = 'INSERT' AND NEW.entity_type IS NOT NULL AND NEW.entity_id IS NOT NULL THEN
        INSERT INTO reaction_counts (
            entity_type,
            entity_id,
            tenant_id,
            reaction_type,
            count,
            updated_at
        )
        VALUES (
            NEW.entity_type,
            NEW.entity_id,
            NEW.tenant_id,
            NEW.reaction_type,
            1,
            NOW()
        )
        ON CONFLICT (entity_type, entity_id, reaction_type)
        DO UPDATE SET
            count = reaction_counts.count + 1,
            updated_at = NOW();
            
    ELSIF TG_OP = 'DELETE' AND OLD.entity_type IS NOT NULL AND OLD.entity_id IS NOT NULL THEN
        UPDATE reaction_counts
        SET
            count = GREATEST(count - 1, 0),
            updated_at = NOW()
        WHERE
            entity_type = OLD.entity_type
            AND entity_id = OLD.entity_id
            AND reaction_type = OLD.reaction_type;
            
    ELSIF TG_OP = 'UPDATE' AND 
          OLD.entity_type IS NOT NULL AND OLD.entity_id IS NOT NULL AND
          NEW.entity_type IS NOT NULL AND NEW.entity_id IS NOT NULL THEN
        -- Decrementa reação antiga
        UPDATE reaction_counts
        SET
            count = GREATEST(count - 1, 0),
            updated_at = NOW()
        WHERE
            entity_type = OLD.entity_type
            AND entity_id = OLD.entity_id
            AND reaction_type = OLD.reaction_type;
            
        -- Incrementa reação nova
        INSERT INTO reaction_counts (
            entity_type,
            entity_id,
            tenant_id,
            reaction_type,
            count,
            updated_at
        )
        VALUES (
            NEW.entity_type,
            NEW.entity_id,
            NEW.tenant_id,
            NEW.reaction_type,
            1,
            NOW()
        )
        ON CONFLICT (entity_type, entity_id, reaction_type)
        DO UPDATE SET
            count = reaction_counts.count + 1,
            updated_at = NOW();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger se necessário (idempotente)
DROP TRIGGER IF EXISTS trigger_update_reaction_count ON reactions;

CREATE TRIGGER trigger_update_reaction_count
AFTER INSERT OR UPDATE OR DELETE
ON reactions
FOR EACH ROW
EXECUTE FUNCTION update_reaction_count();

-- ============================================================
-- DOCUMENTAÇÃO
-- ============================================================

COMMENT ON COLUMN reactions.entity_type IS
'Migration 161: Coluna adicionada para compatibilidade com migration 160. Pode ser NULL para preservar dados antigos.';

COMMENT ON COLUMN reactions.entity_id IS
'Migration 161: Coluna adicionada para compatibilidade com migration 160. Pode ser NULL para preservar dados antigos.';

