-- ============================================================
-- UNIFICARD - MIGRATION 158
-- SPRINT 15: Piloto Vivo - Observação Humana
-- Tabelas: pilot_checklist, pilot_notes
-- ============================================================
--
-- OBJETIVO:
-- Criar tabelas para observação humana manual durante o piloto.
-- Permite checklist e notas livres por usuário.
--
-- REGRAS:
-- - Apenas ativo quando PILOT_MODE=true
-- - Não gera eventos automáticos
-- - Não afeta sistema
-- - Visível apenas para admin
-- ============================================================

-- ============================================================
-- TABELA: pilot_checklist
-- ============================================================
CREATE TABLE IF NOT EXISTS pilot_checklist (
    -- Identificação
    checklist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Usuário observado (actor_id ou user_id)
    observed_user_id UUID NOT NULL,
    
    -- Item do checklist
    item_key VARCHAR(100) NOT NULL,
    item_label VARCHAR(255) NOT NULL,
    
    -- Status
    checked BOOLEAN NOT NULL DEFAULT false,
    
    -- Admin que marcou
    checked_by_user_id UUID,
    
    -- Timestamps
    checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: pilot_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS pilot_notes (
    -- Identificação
    note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Usuário observado (actor_id ou user_id)
    observed_user_id UUID NOT NULL,
    
    -- Conteúdo da nota (texto livre)
    content TEXT NOT NULL,
    
    -- Admin que criou a nota
    created_by_user_id UUID NOT NULL,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- pilot_checklist
CREATE INDEX IF NOT EXISTS idx_pilot_checklist_tenant_user 
    ON pilot_checklist(tenant_id, observed_user_id);

CREATE INDEX IF NOT EXISTS idx_pilot_checklist_item_key 
    ON pilot_checklist(item_key);

-- pilot_notes
CREATE INDEX IF NOT EXISTS idx_pilot_notes_tenant_user 
    ON pilot_notes(tenant_id, observed_user_id);

CREATE INDEX IF NOT EXISTS idx_pilot_notes_created_at 
    ON pilot_notes(created_at DESC);

-- Índice único para evitar itens duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_checklist_unique_item 
    ON pilot_checklist(tenant_id, observed_user_id, item_key);

CREATE INDEX IF NOT EXISTS idx_pilot_notes_tenant_user_created 
    ON pilot_notes(tenant_id, observed_user_id, created_at DESC);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE pilot_checklist IS 
    'Checklist manual de acompanhamento por usuário - observação humana';

COMMENT ON TABLE pilot_notes IS 
    'Notas livres por usuário - observação humana';

COMMENT ON COLUMN pilot_checklist.item_key IS 
    'Chave do item (ex: understood_context, created_company, etc)';

COMMENT ON COLUMN pilot_checklist.item_label IS 
    'Rótulo legível do item (ex: Entendeu contexto de atuação)';

COMMENT ON COLUMN pilot_notes.content IS 
    'Conteúdo livre da nota (texto simples, não estruturado)';

