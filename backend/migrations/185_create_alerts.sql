-- ============================================================
-- UNIFICARD - MIGRATION 185
-- SPRINT 50: AUTOMAÇÕES OPERACIONAIS (CANÔNICAS)
-- Tabela: alerts
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para alertas operacionais.
-- Alertas são gerados por automações, mas resolvidos manualmente.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - NÃO executar economia automaticamente
-- - NÃO tomar decisão irreversível
-- - Automação só alerta, registra ou muda estado simples
-- ============================================================

-- ============================================================
-- ENUM: Tipo de alerta
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
        CREATE TYPE alert_type AS ENUM (
            'INVENTORY_LOW_STOCK',      -- Estoque baixo
            'INVENTORY_OUT_OF_STOCK',   -- Estoque zerado
            'PAYMENT_FAILED',           -- Pagamento falhou
            'PAYOUT_FAILED',            -- Payout falhou
            'FISCAL_PENDING',           -- Fiscal pendente
            'ORDER_EXPIRED',            -- Pedido expirado
            'RESERVATION_EXPIRED',      -- Reserva expirada
            'OTHER'                     -- Outro
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Severidade
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
        CREATE TYPE alert_severity AS ENUM (
            'LOW',      -- Baixa
            'MEDIUM',   -- Média
            'HIGH',     -- Alta
            'CRITICAL'  -- Crítica
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Status do alerta
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
        CREATE TYPE alert_status AS ENUM (
            'OPEN',     -- Aberto (não visualizado)
            'ACK',      -- Reconhecido (visualizado, mas não resolvido)
            'RESOLVED'  -- Resolvido
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Tipo e severidade
    type alert_type NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'MEDIUM',
    
    -- Mensagem
    message TEXT NOT NULL,
    
    -- Entidade relacionada
    entity_type VARCHAR(50), -- 'order', 'payment', 'payout', 'variant', etc.
    entity_id UUID,
    
    -- Status
    status alert_status NOT NULL DEFAULT 'OPEN',
    
    -- Metadados adicionais (JSONB)
    -- Ex: automation_source, original_event_id, context
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_alerts_tenant
    ON alerts (tenant_id);

-- Índice para buscar alertas abertos
CREATE INDEX IF NOT EXISTS idx_alerts_open
    ON alerts (tenant_id, status)
    WHERE status IN ('OPEN', 'ACK');

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_alerts_type
    ON alerts (tenant_id, type);

-- Índice para buscar por entidade
CREATE INDEX IF NOT EXISTS idx_alerts_entity
    ON alerts (tenant_id, entity_type, entity_id);

-- Índice para buscar por severidade
CREATE INDEX IF NOT EXISTS idx_alerts_severity
    ON alerts (tenant_id, severity, status)
    WHERE status IN ('OPEN', 'ACK');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_rls ON alerts
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE alerts IS
    'Alertas operacionais gerados por automações. Resolvidos manualmente.';

COMMENT ON COLUMN alerts.type IS
    'Tipo de alerta: INVENTORY_LOW_STOCK, PAYMENT_FAILED, etc.';

COMMENT ON COLUMN alerts.severity IS
    'Severidade: LOW, MEDIUM, HIGH, CRITICAL.';

COMMENT ON COLUMN alerts.status IS
    'Status: OPEN (não visualizado), ACK (reconhecido), RESOLVED (resolvido).';

COMMENT ON COLUMN alerts.entity_type IS
    'Tipo da entidade relacionada: order, payment, variant, etc.';

COMMENT ON COLUMN alerts.entity_id IS
    'ID da entidade relacionada.';

COMMENT ON COLUMN alerts.metadata IS
    'Metadados: automation_source, original_event_id, context.';







