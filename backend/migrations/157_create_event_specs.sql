-- ============================================================
-- UNIFICARD - MIGRATION 157
-- EventSpecs - Especificações Declarativas de Eventos
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para armazenar EventSpecs (especificações declarativas de eventos).
-- EventSpec é um snapshot imutável versionado que NÃO decide nada.
-- É apenas especificação declarada pelo usuário.
--
-- REGRAS INSTITUCIONAIS:
-- - EventSpec NÃO é usado para ranking
-- - EventSpec NÃO é usado para score
-- - EventSpec NÃO é usado para decisão automática
-- - EventSpec é apenas especificação declarada pelo usuário
-- - EventSpec é imutável (append-only)
--
-- ============================================================

-- ============================================================
-- TABELA: event_specs
-- ============================================================
CREATE TABLE IF NOT EXISTS event_specs (
    -- Identificação
    spec_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que criou o spec
    actor_id UUID NOT NULL,
    actor_type VARCHAR(20) NOT NULL
        CHECK (actor_type IN ('user', 'page', 'group', 'channel')),
    
    -- Evento associado (opcional - pode ser criado depois)
    event_id UUID
        REFERENCES events(id) ON DELETE SET NULL,
    
    -- Versão e tipo
    spec_version INTEGER NOT NULL DEFAULT 1
        CHECK (spec_version >= 1),
    macro_intention VARCHAR(50) NOT NULL,
    subflow VARCHAR(50) NOT NULL,
    
    -- Respostas do questionário (JSONB para flexibilidade)
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Metadados opcionais
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Usuário que preencheu o questionário
    created_by UUID NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    
    -- ⚠️ NÃO incluir updated_at - EventSpec é imutável
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_specs_tenant_id 
    ON event_specs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_specs_actor_id 
    ON event_specs(actor_id);

CREATE INDEX IF NOT EXISTS idx_event_specs_event_id 
    ON event_specs(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_specs_macro_intention 
    ON event_specs(macro_intention);

CREATE INDEX IF NOT EXISTS idx_event_specs_subflow 
    ON event_specs(subflow);

CREATE INDEX IF NOT EXISTS idx_event_specs_spec_version 
    ON event_specs(spec_version);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_event_specs_tenant_actor 
    ON event_specs(tenant_id, actor_id, created_at DESC);

-- Índice GIN para busca em answers (JSONB)
CREATE INDEX IF NOT EXISTS idx_event_specs_answers_gin 
    ON event_specs USING GIN (answers);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE event_specs IS 
    'Especificações declarativas de eventos - snapshot imutável versionado. NÃO usado para decisão de negócio.';

COMMENT ON COLUMN event_specs.spec_version IS 
    'Versão do schema do EventSpec. Incrementar quando houver mudança estrutural incompatível.';

COMMENT ON COLUMN event_specs.macro_intention IS 
    'Macro-intenção do evento (celebrate, gather, teach, etc.)';

COMMENT ON COLUMN event_specs.subflow IS 
    'Subfluxo específico dentro da macro-intenção (birthday_party, wedding, etc.)';

COMMENT ON COLUMN event_specs.answers IS 
    'Respostas do questionário em formato JSONB. Estrutura flexível por question_id.';

COMMENT ON COLUMN event_specs.metadata IS 
    'Metadados opcionais (questionnaire_version, completed_steps, etc.)';

COMMENT ON COLUMN event_specs.created_by IS 
    'ID do usuário que preencheu o questionário';

-- ============================================================
-- REGRA: EventSpec é imutável (append-only)
-- ============================================================
-- Não há UPDATE permitido - apenas INSERT
-- Se precisar "atualizar", criar novo spec com nova versão



