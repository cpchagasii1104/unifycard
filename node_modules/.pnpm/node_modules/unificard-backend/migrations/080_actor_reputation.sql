-- ============================================================
-- UNIFICARD - MIGRATION 080
-- FASE 11: Reputação Progressiva & Permissões
-- ============================================================
--
-- OBJETIVO:
-- Armazenar reputação agregada por ator (PF/PJ) para suportar
-- desbloqueios progressivos, permissões e visibilidade.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - actor_reputation NÃO é fonte da verdade
-- - É um CACHE DERIVADO de:
--   • impact_ledger
--   • impact_balances
-- - A APLICAÇÃO é responsável por:
--   • calcular reputação
--   • atualizar esta tabela de forma idempotente
-- - O BANCO NÃO:
--   • recalcula reputação
--   • aplica regras de progressão
--   • executa triggers automáticas
--
-- DECISÕES IMPORTANTES:
-- - Campos podem assumir valores negativos no futuro
--   (penalidades, decay, correções históricas)
-- - updated_at é atualizado pela aplicação
-- - created_at é imutável
--
-- DEPENDÊNCIAS:
-- - Tabela tenants (tenant_id)
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Pode ser executada isoladamente
-- ============================================================


-- ============================================================
-- TABELA DE REPUTAÇÃO POR ATOR
-- ============================================================
CREATE TABLE IF NOT EXISTS actor_reputation (
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL
        CHECK (actor_type IN ('user', 'page')),

    impact_total INTEGER NOT NULL DEFAULT 0,
    active_days INTEGER NOT NULL DEFAULT 0,
    diversity_score INTEGER NOT NULL DEFAULT 0,

    reputation_level INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (tenant_id, actor_id, actor_type)
);


-- ============================================================
-- ÍNDICES ÚTEIS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_actor_reputation_level
    ON actor_reputation (tenant_id, reputation_level, updated_at DESC);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE actor_reputation IS
    'Cache de reputação agregada por ator. Derivado de impacto e atividade. Não é fonte da verdade.';

COMMENT ON COLUMN actor_reputation.impact_total IS
    'Impacto acumulado do ator. Valor derivado de impact_balances.';

COMMENT ON COLUMN actor_reputation.active_days IS
    'Quantidade de dias distintos com pelo menos um evento de impacto.';

COMMENT ON COLUMN actor_reputation.diversity_score IS
    'Quantidade de tipos distintos de ações realizadas pelo ator.';

COMMENT ON COLUMN actor_reputation.reputation_level IS
    'Nível de reputação calculado pela aplicação. Usado para desbloqueios progressivos.';




















