-- 20260731120000_alerts_substrate.sql
-- DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II: relocação de migrations_archive/0850_alerts.sql
-- (SPRINT 50) — a tabela `alerts` nunca migrou pra fora do arquivo, mas 3 callers vivos
-- (automation.service.ts, subscriptions/subscription.service.ts, core/reputation/penalty.service.ts)
-- já chamam alertRepository.createAlert() contra ela: 42P01 em produção, quebrando a cadeia
-- constitucional do ARTIGO II (conflito → fato → alerta → humano).
--
-- FK corrigida na relocação: a DDL arquivada referenciava `tenants(tenant_id)` — coluna que não
-- existe mais no schema vivo (a PK de `tenants` é `id`). Sem essa correção esta migration não
-- executaria. RLS acompanhada de FORCE (convenção atual do schema vivo; a DDL arquivada só tinha
-- ENABLE) — createAlert/updateAlertStatus/getAlertById/listAlerts/countOpenAlerts já usam
-- runQueryWithTenant/runQueriesWithTenant (GUC app.current_tenant setado), então RLS aqui não
-- quebra nenhum caller, ao contrário de auth_rate_limit_logs (pool cru, sem GUC — por isso aquela
-- tabela é SEM RLS por decisão deliberada; esta é o caso oposto).
--
-- CASE corrigido na relocação: a DDL arquivada tinha alert_severity/alert_status em MAIÚSCULO
-- ('HIGH','OPEN',...). automation.types.ts (AlertSeverity/AlertStatus) e TODOS os 5 callers vivos
-- (automation.service.ts ×10, subscription.service.ts ×2, penalty.service.ts ×2) escrevem em
-- minúsculo ('high','medium','low'; nenhum escreve `status` — vem do DEFAULT). Enum do Postgres é
-- case-sensitive: relocar literal trocaria 42P01 por "invalid input value for enum" em 100% das
-- escritas vivas. Mesma classe da correção de FK — mecânica, não vocabulário. alert_type já bate
-- em maiúsculo com o TS (INVENTORY_LOW_STOCK etc.) — não mexido.
--
-- DECISÃO D-E (Clayton, 2026-07-31, REMEDIATION_DT_LOG.md): alert_type nasce com o 9º valor
-- RISK_SCORE_LOW já no CREATE TYPE inicial — nunca existiu no banco, então é criação, não ALTER.

BEGIN;

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
            'OTHER',                    -- Outro
            'RISK_SCORE_LOW'            -- Score de risco baixo (DECISÃO D-E, 2026-07-31)
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
        CREATE TYPE alert_severity AS ENUM (
            'low',      -- Baixa
            'medium',   -- Média
            'high',     -- Alta
            'critical'  -- Crítica
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
        CREATE TYPE alert_status AS ENUM (
            'open',     -- Aberto (não visualizado)
            'ack',      -- Reconhecido (visualizado, mas não resolvido)
            'resolved'  -- Resolvido
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(id) ON DELETE CASCADE,

    type alert_type NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'medium',

    message TEXT NOT NULL,

    entity_type VARCHAR(50), -- 'order', 'payment', 'payout', 'variant', etc.
    entity_id UUID,

    status alert_status NOT NULL DEFAULT 'open',

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant
    ON alerts (tenant_id);

CREATE INDEX IF NOT EXISTS idx_alerts_open
    ON alerts (tenant_id, status)
    WHERE status IN ('open', 'ack');

CREATE INDEX IF NOT EXISTS idx_alerts_type
    ON alerts (tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_alerts_entity
    ON alerts (tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_alerts_severity
    ON alerts (tenant_id, severity, status)
    WHERE status IN ('open', 'ack');

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alerts_rls ON alerts;
CREATE POLICY alerts_rls ON alerts
    USING (tenant_id::text = current_setting('app.current_tenant', true));

DROP TRIGGER IF EXISTS alerts_updated_at ON alerts;
CREATE TRIGGER alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE alerts IS
    'Alertas operacionais gerados por automações. Resolvidos manualmente. ARTIGO II
     (constitucional): alertas são gerados por automações, mas resolvidos manualmente — NÃO
     executar economia automaticamente, NÃO tomar decisão irreversível; automação só alerta,
     registra ou muda estado simples. Relocada de migrations_archive/0850_alerts.sql
     (DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II, 2026-07-31) — a tabela nunca existiu no
     banco vivo apesar de callers vivos (automation.service.ts, subscription.service.ts,
     penalty.service.ts) já chamarem createAlert() contra ela.';

COMMENT ON COLUMN alerts.type IS
    'Tipo de alerta — 9 valores (8 originais da SPRINT 50 + RISK_SCORE_LOW, DECISÃO D-E
     2026-07-31): INVENTORY_LOW_STOCK, INVENTORY_OUT_OF_STOCK, PAYMENT_FAILED, PAYOUT_FAILED,
     FISCAL_PENDING, ORDER_EXPIRED, RESERVATION_EXPIRED, OTHER, RISK_SCORE_LOW.';

COMMENT ON COLUMN alerts.severity IS
    'Severidade: low, medium, high, critical.';

COMMENT ON COLUMN alerts.status IS
    'Status: open (não visualizado), ack (reconhecido), resolved (resolvido).';

COMMENT ON COLUMN alerts.entity_type IS
    'Tipo da entidade relacionada: order, payment, variant, etc. NUNCA o valor de alerts.type —
     achado da DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II: automation.service.ts:75 gravava
     "variant" (um entity_type) dentro do campo type por engano.';

COMMENT ON COLUMN alerts.entity_id IS
    'ID da entidade relacionada.';

COMMENT ON COLUMN alerts.metadata IS
    'Metadados: automation_source, original_event_id, context.';

COMMIT;
