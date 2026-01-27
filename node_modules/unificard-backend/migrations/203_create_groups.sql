-- ============================================================
-- UNIFICARD - MIGRATION 203
-- SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES
-- Tabela: groups - Adicionar colunas faltantes
-- ============================================================
--
-- NOTA: A tabela groups já existe de migrations anteriores.
-- Esta migration apenas adiciona colunas faltantes se necessário.
-- ============================================================

-- Adicionar parent_group_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'groups' AND column_name = 'parent_group_id'
    ) THEN
        ALTER TABLE groups ADD COLUMN parent_group_id UUID;

        -- Adicionar FK se tabela existir
        ALTER TABLE groups ADD CONSTRAINT fk_groups_parent
            FOREIGN KEY (parent_group_id) REFERENCES groups(group_id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Adicionar created_by_actor_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'groups' AND column_name = 'created_by_actor_id'
    ) THEN
        ALTER TABLE groups ADD COLUMN created_by_actor_id UUID;
    END IF;
END $$;

-- Índice para buscar por parent (se não existir)
CREATE INDEX IF NOT EXISTS idx_groups_parent_group_id
    ON groups(tenant_id, parent_group_id)
    WHERE parent_group_id IS NOT NULL;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN groups.parent_group_id IS 'Grupo pai (para hierarquia)';




