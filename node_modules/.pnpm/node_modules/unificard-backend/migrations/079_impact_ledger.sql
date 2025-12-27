-- Migration: 079_impact_ledger.sql
-- FASE 10: Impacto Real + Ledger por Ator
-- Cria tabelas para rastrear impacto social por ator (PF/PJ) com ledger obrigatório

-- Tabela de ledger de impacto (event sourcing simples)
CREATE TABLE IF NOT EXISTS impact_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'page')),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('LIKE', 'SUPPORT', 'JOIN_GROUP', 'POST_PUBLISHED')),
    impact_delta INTEGER NOT NULL CHECK (impact_delta != 0),
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('post', 'group', 'project', 'system')),
    source_id VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Índices para performance (sem constraint UNIQUE, pois pode haver múltiplos eventos no mesmo timestamp)
);

-- Índices adicionais
CREATE INDEX IF NOT EXISTS idx_impact_ledger_actor ON impact_ledger(tenant_id, actor_id, actor_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_ledger_source ON impact_ledger(tenant_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_impact_ledger_event_type ON impact_ledger(tenant_id, event_type, created_at DESC);

-- Tabela de saldos agregados (performance)
CREATE TABLE IF NOT EXISTS impact_balances (
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'page')),
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, actor_id, actor_type),
    
    -- Garantir que balance nunca seja negativo (por enquanto)
    CONSTRAINT impact_balances_balance_check CHECK (balance >= 0)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_impact_balances_actor ON impact_balances(tenant_id, actor_id, actor_type);

-- Comentários
COMMENT ON TABLE impact_ledger IS 'Ledger de eventos de impacto social por ator (event sourcing)';
COMMENT ON TABLE impact_balances IS 'Saldos agregados de impacto por ator (cache para performance)';
COMMENT ON COLUMN impact_ledger.metadata IS 'Metadados adicionais (ex: target_actor_id, target_actor_type)';
COMMENT ON COLUMN impact_ledger.impact_delta IS 'Variação de impacto (+1, +2, +5, etc). Nunca pode ser 0.';

