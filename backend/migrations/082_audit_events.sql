-- Migration: 082_audit_events.sql
-- FASE 13: Auditoria & Alertas Anti-Abuso
-- Cria tabela para rastrear eventos de auditoria e alertas de comportamento suspeito

-- Tabela de eventos de auditoria
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- Tipo de evento (EMPLOYEE_VALIDATION_SPIKE, COMPANY_IMPACT_SPIKE, etc)
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    actor_id VARCHAR(255), -- ID do ator (pode ser PF ou PJ)
    actor_type VARCHAR(20) CHECK (actor_type IN ('user', 'page')),
    company_id UUID REFERENCES companies(company_id) ON DELETE SET NULL,
    employee_id UUID REFERENCES partner_employees(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL, -- Fonte: impact, validation, reputation, social
    context JSONB NOT NULL DEFAULT '{}', -- Métricas, contagens, janelas de tempo, etc
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE, -- Quando foi resolvido/revisado
    resolution_note TEXT, -- Nota de resolução (opcional)
    
    CONSTRAINT audit_events_severity_check CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- Índices para busca e análise rápida
CREATE INDEX IF NOT EXISTS idx_audit_events_severity_date ON audit_events(tenant_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(tenant_id, actor_id, actor_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_company ON audit_events(tenant_id, company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_employee ON audit_events(tenant_id, employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(tenant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_unresolved ON audit_events(tenant_id, resolved_at) WHERE resolved_at IS NULL;

-- Comentários
COMMENT ON TABLE audit_events IS 'Eventos de auditoria e alertas de comportamento suspeito (FASE 13)';
COMMENT ON COLUMN audit_events.event_type IS 'Tipo de evento: EMPLOYEE_VALIDATION_SPIKE, COMPANY_IMPACT_SPIKE, LOW_ACTION_DIVERSITY, REPUTATION_ANOMALY, VALIDATION_ABUSE_ATTEMPT';
COMMENT ON COLUMN audit_events.severity IS 'Severidade: LOW (observar), MEDIUM (investigar), HIGH (ação imediata), CRITICAL (bloqueio)';
COMMENT ON COLUMN audit_events.context IS 'Contexto do evento em JSON: métricas, contagens, janelas de tempo, etc';
COMMENT ON COLUMN audit_events.source IS 'Fonte do evento: impact, validation, reputation, social';
COMMENT ON COLUMN audit_events.resolved_at IS 'Data de resolução/revisão do alerta (NULL = não resolvido)';













