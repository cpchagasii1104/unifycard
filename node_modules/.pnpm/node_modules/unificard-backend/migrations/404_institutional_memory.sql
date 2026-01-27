-- ============================================================
-- UNIFICARD - MIGRATION 157
-- SPRINT 26: Memória Institucional Declarativa
-- Tabela: institutional_memory_declarations
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para armazenar declarações textuais de aprendizado institucional.
-- Permite que operadores humanos registrem aprendizados explícitos sobre o piloto.
--
-- REGRAS:
-- - Apenas texto livre, sem estruturação forçada
-- - Não gera eventos ou ações automáticas
-- - Não vira regra ou política
-- - Apenas memória explícita e declarada
-- ============================================================

-- ============================================================
-- TABELA: institutional_memory_declarations
-- ============================================================
CREATE TABLE IF NOT EXISTS institutional_memory_declarations (
    -- Identificação
    declaration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Conteúdo da declaração
    content TEXT NOT NULL,
    
    -- Autor (user_id do operador)
    author_user_id UUID NOT NULL
        REFERENCES global_users(global_user_id) ON DELETE SET NULL,
    
    -- Contexto opcional (ex: 'pilot', 'general_reading')
    context VARCHAR(50) DEFAULT 'pilot',
    
    -- Versão incremental (para rastrear evolução)
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Soft delete (para manter histórico)
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_institutional_memory_tenant_id 
    ON institutional_memory_declarations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_institutional_memory_author 
    ON institutional_memory_declarations(author_user_id);

CREATE INDEX IF NOT EXISTS idx_institutional_memory_context 
    ON institutional_memory_declarations(context);

CREATE INDEX IF NOT EXISTS idx_institutional_memory_created 
    ON institutional_memory_declarations(created_at DESC);

-- Índice para consultas ativas (não deletadas)
CREATE INDEX IF NOT EXISTS idx_institutional_memory_active 
    ON institutional_memory_declarations(tenant_id, deleted_at)
    WHERE deleted_at IS NULL;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE institutional_memory_declarations IS 
    'Declarações textuais de aprendizado institucional - apenas memória explícita, sem consequências operacionais';

COMMENT ON COLUMN institutional_memory_declarations.content IS 
    'Texto livre da declaração de aprendizado';

COMMENT ON COLUMN institutional_memory_declarations.author_user_id IS 
    'ID do operador humano que registrou a declaração';

COMMENT ON COLUMN institutional_memory_declarations.context IS 
    'Contexto da declaração (ex: pilot, general_reading)';

COMMENT ON COLUMN institutional_memory_declarations.version IS 
    'Versão incremental para rastrear evolução da declaração';

COMMENT ON COLUMN institutional_memory_declarations.deleted_at IS 
    'Soft delete - mantém histórico mesmo quando removido';







