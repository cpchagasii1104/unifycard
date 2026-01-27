-- ============================================================
-- UNIFICARD - MIGRATION 160
-- Tabela: reactions
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para reactions (like/dislike) como observabilidade passiva.
--
-- REGRAS CANÔNICAS:
-- - Reactions são passivas
-- - Não alteram UX automaticamente
-- - Contagem agregada é read-model separado
--
-- ============================================================

-- Garantir extensão para UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABELA: reactions
-- ============================================================

CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Entidade reagida
    entity_type VARCHAR(50) NOT NULL
        CHECK (entity_type IN ('event', 'post', 'group', 'channel')),
    entity_id UUID NOT NULL,

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id)
        ON DELETE CASCADE,

    -- Tipo de reação
    reaction_type VARCHAR(50) NOT NULL DEFAULT 'like'
        CHECK (reaction_type IN ('like', 'dislike', 'love', 'laugh', 'angry', 'sad')),

    -- Quem reagiu
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    actor_id UUID
        REFERENCES actors(actor_id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Um usuário só pode reagir uma vez por entidade
    CONSTRAINT unique_user_entity_reaction
        UNIQUE (entity_type, entity_id, user_id)
);

-- ============================================================
-- ÍNDICES reactions
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reactions_entity
    ON reactions(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_reactions_user
    ON reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_reactions_actor
    ON reactions(actor_id)
    WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reactions_tenant
    ON reactions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_reactions_type
    ON reactions(reaction_type);

CREATE INDEX IF NOT EXISTS idx_reactions_created_at
    ON reactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reactions_aggregation
    ON reactions(entity_type, entity_id, reaction_type);

-- ============================================================
-- TABELA: reaction_counts (READ MODEL)
-- ============================================================

CREATE TABLE IF NOT EXISTS reaction_counts (
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

-- ============================================================
-- FUNÇÃO: update_reaction_count
-- ============================================================

CREATE OR REPLACE FUNCTION update_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
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

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reaction_counts
        SET
            count = GREATEST(count - 1, 0),
            updated_at = NOW()
        WHERE
            entity_type = OLD.entity_type
            AND entity_id = OLD.entity_id
            AND reaction_type = OLD.reaction_type;

    ELSIF TG_OP = 'UPDATE' THEN
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

-- ============================================================
-- TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trigger_update_reaction_count ON reactions;

CREATE TRIGGER trigger_update_reaction_count
AFTER INSERT OR UPDATE OR DELETE
ON reactions
FOR EACH ROW
EXECUTE FUNCTION update_reaction_count();

-- ============================================================
-- DOCUMENTAÇÃO
-- ============================================================

COMMENT ON TABLE reactions IS
'Reações (like/dislike) como observabilidade passiva. Não altera UX automaticamente.';

COMMENT ON TABLE reaction_counts IS
'Contagem agregada de reactions (read-model para performance).';

COMMENT ON COLUMN reactions.reaction_type IS
'Tipo de reação: like, dislike, love, laugh, angry, sad';

COMMENT ON COLUMN reactions.actor_id IS
'Actor opcional se a reação foi feita como entidade institucional';
