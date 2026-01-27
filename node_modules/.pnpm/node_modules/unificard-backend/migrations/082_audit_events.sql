-- ============================================================
-- UNIFICARD - MIGRATION 082
-- FASE 13: Auditoria & Alertas Anti-Abuso
-- ============================================================
--
-- OBJETIVO:
-- Registrar eventos de auditoria e alertas de comportamento
-- suspeito para análise humana, investigação e ação manual.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - audit_events é um LOG IMUTÁVEL (append-only)
-- - O BANCO:
--   • registra sinais e evidências
--   • preserva histórico
-- - A APLICAÇÃO / OPERAÇÃO:
--   • analisa eventos
--   • decide ações (bloqueio, punição, reversão)
-- - Resolver um evento NÃO altera o evento em si
--   • apenas adiciona contexto de resolução
--
-- DECISÕES IMPORTANTES:
-- - Eventos podem ser:
--   • por ator
--   • por empresa
--   • por funcionário
--   • sistêmicos (sem ator)
-- - Campo source é propositalmente livre
--   (novas fontes surgirão)
--
-- DEPENDÊNCIAS:
-- - tenants
-- - companies
-- - partner_employees
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- TABELA DE EVENTOS DE AUDITORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    event_type VARCHAR(100) NOT NULL,

    severity VARCHAR(20) NOT NULL
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    actor_id VARCHAR(255),
    actor_type VARCHAR(20)
        CHECK (actor_type IN ('user', 'page')),

    company_id UUID
        REFERENCES companies(company_id) ON DELETE SET NULL,

    employee_id UUID
        REFERENCES partner_employees(id) ON DELETE SET NULL,

    source VARCHAR(50) NOT NULL,

    context JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_note TEXT
);


-- ============================================================
-- ÍNDICES PARA ANÁLISE E AUDITORIA
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_events_severity_date
    ON audit_events (tenant_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor
    ON audit_events (tenant_id, actor_id, actor_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_company
    ON audit_events (tenant_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_employee
    ON audit_events (tenant_id, employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_type
    ON audit_events (tenant_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_unresolved
    ON audit_events (tenant_id, resolved_at)
    WHERE resolved_at IS NULL;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE audit_events IS
    'Log imutável de eventos de auditoria e alertas de comportamento suspeito.';

COMMENT ON COLUMN audit_events.event_type IS
    'Tipo do evento de auditoria (ex: EMPLOYEE_VALIDATION_SPIKE, COMPANY_IMPACT_SPIKE, REPUTATION_ANOMALY).';

COMMENT ON COLUMN audit_events.severity IS
    'Severidade do alerta: LOW, MEDIUM, HIGH, CRITICAL.';

COMMENT ON COLUMN audit_events.context IS
    'Contexto do evento em JSON: métricas, contagens, janelas de tempo, evidências.';

COMMENT ON COLUMN audit_events.source IS
    'Fonte geradora do evento (impact, validation, reputation, social, etc).';

COMMENT ON COLUMN audit_events.resolved_at IS
    'Data em que o evento foi revisado/resolvido. NULL indica pendente.';













