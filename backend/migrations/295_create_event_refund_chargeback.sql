-- ============================================================
-- UNIFICARD - MIGRATION 295
-- FASE 6.0: Event Refund and Chargeback (Estorno e Chargeback)
-- FASE_6_FLUXO_ESTORNO_CHARGEBACK.md
-- ============================================================
--
-- OBJETIVO:
-- Criar tabelas event_refund e event_chargeback para estorno e chargeback.
--
-- PRINCÍPIO CENTRAL:
-- Toda execução econômica DEVE ser reversível.
-- 
-- Se não pode ser estornado:
-- → não pode ser executado.
--
-- TIPOS DE REVERSÃO:
-- - Estorno antes da execução
-- - Estorno após execução
-- - Estorno parcial
-- - Chargeback externo (ex: adquirente)
-- - Cancelamento institucional
--
-- PROIBIDO:
-- - correção manual
-- - ajuste silencioso
-- - apagar histórico econômico
-- ============================================================

-- ============================================================
-- ENUM: refund_type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_type') THEN
    CREATE TYPE refund_type AS ENUM (
      'full',         -- Estorno total
      'partial',      -- Estorno parcial
      'chargeback',   -- Chargeback
      'cancellation'  -- Cancelamento institucional
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: refund_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
    CREATE TYPE refund_status AS ENUM (
      'requested',  -- Estorno solicitado
      'approved',   -- Estorno aprovado
      'executed',   -- Estorno executado
      'rejected',   -- Estorno rejeitado
      'cancelled'   -- Estorno cancelado
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: chargeback_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chargeback_status') THEN
    CREATE TYPE chargeback_status AS ENUM (
      'initiated',  -- Chargeback iniciado
      'resolved',   -- Chargeback resolvido (aprovado)
      'rejected',   -- Chargeback rejeitado
      'cancelled'   -- Chargeback cancelado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: event_refund
-- ============================================================

CREATE TABLE IF NOT EXISTS event_refund (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,
  
  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,
  
  custody_id UUID NOT NULL
    REFERENCES event_custody(id)
    ON DELETE CASCADE,
  
  -- Tipo de estorno
  refund_type refund_type NOT NULL,
  
  -- Valor do estorno
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  
  -- Status do estorno
  status refund_status NOT NULL DEFAULT 'requested',
  
  -- Motivo do estorno
  reason TEXT NOT NULL,
  
  -- Atores envolvidos
  requested_by_actor_id UUID NOT NULL,
  approved_by_actor_id UUID,
  executed_by_actor_id UUID,
  
  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata (opcional, para auditoria)
  metadata JSONB DEFAULT '{}'
);

-- ============================================================
-- TABELA: event_chargeback
-- ============================================================

CREATE TABLE IF NOT EXISTS event_chargeback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,
  
  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,
  
  custody_id UUID NOT NULL
    REFERENCES event_custody(id)
    ON DELETE CASCADE,
  
  -- Valor do chargeback
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  
  -- Status do chargeback
  status chargeback_status NOT NULL DEFAULT 'initiated',
  
  -- Referência externa (ex: adquirente)
  external_reference VARCHAR(255),
  
  -- Motivo do chargeback
  reason TEXT NOT NULL,
  
  -- Atores envolvidos
  initiated_by_actor_id UUID NOT NULL,
  resolved_by_actor_id UUID,
  
  -- Congelamento de execuções
  frozen_executions BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata (opcional, para auditoria)
  metadata JSONB DEFAULT '{}'
);

-- ============================================================
-- ÍNDICES: event_refund
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_refund_tenant_event
  ON event_refund (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_refund_tenant_custody
  ON event_refund (tenant_id, custody_id);

CREATE INDEX IF NOT EXISTS idx_event_refund_tenant_status
  ON event_refund (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_event_refund_requested_at
  ON event_refund (tenant_id, requested_at DESC);

-- ============================================================
-- ÍNDICES: event_chargeback
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_chargeback_tenant_event
  ON event_chargeback (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_chargeback_tenant_custody
  ON event_chargeback (tenant_id, custody_id);

CREATE INDEX IF NOT EXISTS idx_event_chargeback_tenant_status
  ON event_chargeback (tenant_id, status)
  WHERE status = 'initiated' AND frozen_executions = true;

CREATE INDEX IF NOT EXISTS idx_event_chargeback_initiated_at
  ON event_chargeback (tenant_id, initiated_at DESC);

-- ============================================================
-- RLS (Row Level Security): event_refund
-- ============================================================

ALTER TABLE event_refund ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'event_refund'
      AND policyname = 'event_refund_tenant_isolation'
  ) THEN
    CREATE POLICY event_refund_tenant_isolation
      ON event_refund
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- RLS (Row Level Security): event_chargeback
-- ============================================================

ALTER TABLE event_chargeback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'event_chargeback'
      AND policyname = 'event_chargeback_tenant_isolation'
  ) THEN
    CREATE POLICY event_chargeback_tenant_isolation
      ON event_chargeback
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trigger_update_event_refund_updated_at ON event_refund;
CREATE TRIGGER trigger_update_event_refund_updated_at
  BEFORE UPDATE ON event_refund
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_event_chargeback_updated_at ON event_chargeback;
CREATE TRIGGER trigger_update_event_chargeback_updated_at
  BEFORE UPDATE ON event_chargeback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS: event_refund
-- ============================================================

COMMENT ON TABLE event_refund IS
  'Estornos de eventos (FASE 6.0). Toda execução econômica DEVE ser reversível.';

COMMENT ON COLUMN event_refund.refund_type IS
  'Tipo de estorno: full (total), partial (parcial), chargeback (chargeback), cancellation (cancelamento).';

COMMENT ON COLUMN event_refund.status IS
  'Status do estorno: requested (solicitado), approved (aprovado), executed (executado), rejected (rejeitado), cancelled (cancelado).';

COMMENT ON COLUMN event_refund.reason IS
  'Motivo do estorno. Texto obrigatório explicando por que o estorno foi solicitado.';

-- ============================================================
-- COMENTÁRIOS: event_chargeback
-- ============================================================

COMMENT ON TABLE event_chargeback IS
  'Chargebacks de eventos (FASE 6.0). Chargeback congela novas execuções.';

COMMENT ON COLUMN event_chargeback.status IS
  'Status do chargeback: initiated (iniciado), resolved (resolvido), rejected (rejeitado), cancelled (cancelado).';

COMMENT ON COLUMN event_chargeback.external_reference IS
  'Referência externa do chargeback (ex: referência do adquirente).';

COMMENT ON COLUMN event_chargeback.frozen_executions IS
  'Indica se o chargeback congela novas execuções. Sempre true quando status = initiated.';

COMMENT ON COLUMN event_chargeback.reason IS
  'Motivo do chargeback. Texto obrigatório explicando por que o chargeback foi iniciado.';

-- ============================================================
-- NOTA DE COMPATIBILIDADE
-- ============================================================
-- Esta migration cria estruturas canônicas para estorno e chargeback.
-- Nenhuma lógica automática é executada.
-- Estado ≠ verdade.
-- Histórico NUNCA é apagado.
-- ============================================================

