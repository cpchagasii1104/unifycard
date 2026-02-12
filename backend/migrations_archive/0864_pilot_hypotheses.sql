-- ============================================================
-- UNIFICARD - MIGRATION 159
-- SPRINT 16: Leitura Institucional (Sensemaking)
-- Tabela: pilot_hypotheses
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para notas de hipótese do operador.
-- Permite interpretação humana do piloto.
--
-- REGRAS:
-- - Apenas ativo quando PILOT_MODE=true
-- - Não processado automaticamente
-- - Não estruturado
-- - Associado ao piloto, não ao usuário
-- ============================================================

-- ============================================================
-- TABELA: pilot_hypotheses
-- ============================================================
CREATE TABLE IF NOT EXISTS pilot_hypotheses (
    -- Identificação
    hypothesis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Conteúdo da hipótese (texto livre)
    content TEXT NOT NULL,
    
    -- Operador que criou a hipótese
    created_by_user_id UUID NOT NULL,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pilot_hypotheses_tenant_id 
    ON pilot_hypotheses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_pilot_hypotheses_created_at 
    ON pilot_hypotheses(created_at DESC);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_pilot_hypotheses_tenant_created 
    ON pilot_hypotheses(tenant_id, created_at DESC);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE pilot_hypotheses IS 
    'Hipóteses do operador sobre o piloto - interpretação humana, não processada automaticamente';

COMMENT ON COLUMN pilot_hypotheses.content IS 
    'Conteúdo livre da hipótese (texto simples, não estruturado)';







