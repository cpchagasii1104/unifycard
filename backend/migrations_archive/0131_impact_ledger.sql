-- ============================================================
-- UNIFICARD - MIGRATION 079
-- FASE 10: Impacto Real + Ledger por Ator
-- ============================================================
--
-- OBJETIVO:
-- Implementar rastreamento de impacto social por ator (PF/PJ)
-- usando modelo de event sourcing com ledger imutável e
-- tabela de saldos agregados para performance.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - impact_ledger é a FONTE DA VERDADE (append-only)
-- - impact_balances é um CACHE DERIVADO
-- - O BANCO NÃO recalcula impacto automaticamente
-- - A APLICAÇÃO é responsável por:
--   • inserir eventos no ledger
--   • atualizar impact_balances de forma idempotente
--   • manter consistência entre ledger e balance
--
-- DECISÕES IMPORTANTES:
-- - NÃO há trigger automática entre ledger e balances
-- - NÃO há CHECK impedindo balance negativo
--   (rollback, penalidades e correções futuras são permitidas)
-- - created_at é imutável
-- - updated_at é controlado pela aplicação
--
-- DEPENDÊNCIAS:
-- - Tabela tenants (tenant_id)
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Pode ser executada isoladamente
-- ============================================================


-- ============================================================
-- LEDGER DE IMPACTO (EVENT SOURCING)
-- ============================================================
CREATE TABLE IF NOT EXISTS impact_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL
        CHECK (actor_type IN ('user', 'page')),

    event_type VARCHAR(50) NOT NULL
        CHECK (event_type IN ('LIKE', 'SUPPORT', 'JOIN_GROUP', 'POST_PUBLISHED')),

    impact_delta INTEGER NOT NULL
        CHECK (impact_delta <> 0),

    source_type VARCHAR(50) NOT NULL
        CHECK (source_type IN ('post', 'group', 'project', 'system')),

    source_id VARCHAR(255) NOT NULL,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para leitura eficiente do ledger
CREATE INDEX IF NOT EXISTS idx_impact_ledger_actor
    ON impact_ledger (tenant_id, actor_id, actor_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_impact_ledger_source
    ON impact_ledger (tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_impact_ledger_event_type
    ON impact_ledger (tenant_id, event_type, created_at DESC);


-- ============================================================
-- SALDOS AGREGADOS DE IMPACTO (CACHE)
-- ============================================================
CREATE TABLE IF NOT EXISTS impact_balances (
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL
        CHECK (actor_type IN ('user', 'page')),

    balance INTEGER NOT NULL DEFAULT 0,

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (tenant_id, actor_id, actor_type)
);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE impact_ledger IS
    'Ledger imutável de eventos de impacto social por ator (event sourcing). Fonte da verdade.';

COMMENT ON TABLE impact_balances IS
    'Cache de saldos agregados de impacto por ator. Atualizado exclusivamente pela aplicação.';

COMMENT ON COLUMN impact_ledger.impact_delta IS
    'Variação de impacto do evento. Pode ser positiva ou negativa, nunca zero.';

COMMENT ON COLUMN impact_ledger.metadata IS
    'Metadados adicionais do evento (ex: target_actor_id, target_actor_type).';

COMMENT ON COLUMN impact_balances.balance IS
    'Saldo agregado de impacto. Valor derivado do ledger, não é fonte da verdade.';
