-- Migration: 080_actor_reputation.sql
-- FASE 11: Reputação Progressiva & Permissões
-- Cria tabela para rastrear reputação por ator baseada em comportamento verificável

-- Tabela de reputação por ator
CREATE TABLE IF NOT EXISTS actor_reputation (
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'page')),
    impact_total INTEGER NOT NULL DEFAULT 0,
    active_days INTEGER NOT NULL DEFAULT 0, -- Dias distintos com pelo menos 1 evento
    diversity_score INTEGER NOT NULL DEFAULT 0, -- Tipos distintos de ações (LIKE, SUPPORT, etc)
    reputation_level INTEGER NOT NULL DEFAULT 0, -- 0..N (níveis de reputação)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, actor_id, actor_type),
    
    -- Garantir valores não negativos
    CONSTRAINT actor_reputation_impact_check CHECK (impact_total >= 0),
    CONSTRAINT actor_reputation_active_days_check CHECK (active_days >= 0),
    CONSTRAINT actor_reputation_diversity_check CHECK (diversity_score >= 0),
    CONSTRAINT actor_reputation_level_check CHECK (reputation_level >= 0)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_actor_reputation_actor ON actor_reputation(tenant_id, actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_actor_reputation_level ON actor_reputation(tenant_id, reputation_level, updated_at DESC);

-- Comentários
COMMENT ON TABLE actor_reputation IS 'Reputação progressiva por ator baseada em impacto, tempo e diversidade de ações';
COMMENT ON COLUMN actor_reputation.impact_total IS 'Soma total de impacto acumulado (fonte: impact_balances)';
COMMENT ON COLUMN actor_reputation.active_days IS 'Dias distintos com pelo menos 1 evento no ledger';
COMMENT ON COLUMN actor_reputation.diversity_score IS 'Quantidade de tipos distintos de ações realizadas';
COMMENT ON COLUMN actor_reputation.reputation_level IS 'Nível de reputação calculado (0 = padrão, 1+ = desbloqueios progressivos)';













