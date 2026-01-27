-- ============================================================
-- UNIFICARD - MIGRATION 292
-- FASE 6.0: Event Custody (Custódia Econômica Institucional)
-- FASE_6_CONTRATO_CUSTODIA.md
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela event_custody para custódia econômica de eventos.
--
-- PRINCÍPIO CENTRAL:
-- Custódia NÃO é pagamento.
-- Custódia é retenção controlada de valor com finalidade explícita.
--
-- REGRAS ABSOLUTAS:
-- - Nenhum valor entra em custódia sem evento explícito
-- - Nenhum valor entra em custódia sem autorização explícita
-- - Nenhum valor entra em custódia sem finalidade explícita
-- - Custódia só pode ser criada se evento está na Fase 6.0
-- - Custódia só pode ser criada se split ainda NÃO foi executado
-- - Custódia só pode ser criada se pagamento ainda NÃO foi liberado
--
-- EVENTO CANÔNICO DE CRIAÇÃO:
-- - event.custody.created
--
-- REVERSIBILIDADE:
-- - Toda custódia DEVE permitir estorno total
-- - Toda custódia DEVE permitir estorno parcial (quando aplicável)
-- - Toda custódia DEVE permitir chargeback
-- ============================================================

-- ============================================================
-- ENUM: custody_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custody_status') THEN
    CREATE TYPE custody_status AS ENUM (
      'active',      -- Custódia ativa (valor retido)
      'released',    -- Custódia liberada (pagamento executado)
      'reverted',    -- Custódia revertida (estorno)
      'cancelled'    -- Custódia cancelada (cancelamento institucional)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: event_custody
-- ============================================================

CREATE TABLE IF NOT EXISTS event_custody (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,
  
  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,
  
  -- Valor custodiado
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  
  -- Dono econômico
  economic_owner_id UUID NOT NULL,
  economic_owner_type VARCHAR(20) NOT NULL CHECK (economic_owner_type IN ('user', 'page', 'group', 'channel')),
  
  -- Condições de liberação (JSONB)
  release_conditions JSONB NOT NULL DEFAULT '{}',
  
  -- Finalidade explícita
  purpose TEXT NOT NULL,
  
  -- Status da custódia
  status custody_status NOT NULL DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reverted_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadata (opcional, para auditoria)
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT event_custody_amount_check CHECK (amount_cents > 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_custody_tenant_event
  ON event_custody (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_custody_tenant_status
  ON event_custody (tenant_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_event_custody_economic_owner
  ON event_custody (tenant_id, economic_owner_id, economic_owner_type);

CREATE INDEX IF NOT EXISTS idx_event_custody_created_at
  ON event_custody (tenant_id, created_at DESC);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE event_custody ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'event_custody'
      AND policyname = 'event_custody_tenant_isolation'
  ) THEN
    CREATE POLICY event_custody_tenant_isolation
      ON event_custody
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trigger_update_event_custody_updated_at ON event_custody;
CREATE TRIGGER trigger_update_event_custody_updated_at
  BEFORE UPDATE ON event_custody
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE event_custody IS
  'Custódia econômica institucional de eventos (FASE 6.0). Custódia NÃO é pagamento.';

COMMENT ON COLUMN event_custody.amount_cents IS
  'Valor custodiado em centavos. Deve ser maior que zero.';

COMMENT ON COLUMN event_custody.economic_owner_id IS
  'ID do dono econômico (actor_id). Identifica quem é o responsável econômico.';

COMMENT ON COLUMN event_custody.economic_owner_type IS
  'Tipo do dono econômico (user, page, group, channel).';

COMMENT ON COLUMN event_custody.release_conditions IS
  'Condições de liberação da custódia (JSONB). Ex: event_completed, payment_authorized, etc.';

COMMENT ON COLUMN event_custody.purpose IS
  'Finalidade explícita da custódia. Texto obrigatório que explica por que a custódia existe.';

COMMENT ON COLUMN event_custody.status IS
  'Status da custódia: active (ativa), released (liberada), reverted (revertida), cancelled (cancelada).';

COMMENT ON COLUMN event_custody.reverted_at IS
  'Timestamp de quando a custódia foi revertida (estorno).';

COMMENT ON COLUMN event_custody.released_at IS
  'Timestamp de quando a custódia foi liberada (pagamento executado).';

-- ============================================================
-- NOTA DE COMPATIBILIDADE
-- ============================================================
-- Esta migration cria estrutura canônica para custódia.
-- Nenhuma lógica automática é executada.
-- Estado ≠ verdade.
-- ============================================================

