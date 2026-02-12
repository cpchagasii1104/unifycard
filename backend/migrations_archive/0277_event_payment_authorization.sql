-- ============================================================
-- UNIFICARD - MIGRATION 294
-- FASE 6.0: Event Payment Authorization (Autorização de Pagamento)
-- FASE_6_MANIFESTO_EXECUCAO_ECONOMICA.md
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela event_payment_authorization para autorização de pagamento.
--
-- PRINCÍPIO CENTRAL:
-- Pagamento preparado NÃO é execução.
-- Pagamento preparado é autorização explícita de intenção de pagamento.
--
-- REGRAS ABSOLUTAS:
-- - NÃO executa pagamento
-- - NÃO libera custódia
-- - NÃO move dinheiro
-- - Pagamento só EXISTE como intenção autorizada
--
-- EVENTO CANÔNICO:
-- - event.payment.authorized
-- ============================================================

-- ============================================================
-- ENUM: payment_authorization_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_authorization_status') THEN
    CREATE TYPE payment_authorization_status AS ENUM (
      'authorized',  -- Pagamento autorizado (preparado, não executado)
      'revoked',     -- Autorização revogada
      'executed',    -- Pagamento executado (após autorização)
      'cancelled'    -- Autorização cancelada
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: event_payment_authorization
-- ============================================================

CREATE TABLE IF NOT EXISTS event_payment_authorization (
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
  
  split_id UUID NOT NULL
    REFERENCES event_split_declarative(id)
    ON DELETE CASCADE,
  
  -- Status da autorização
  status payment_authorization_status NOT NULL DEFAULT 'authorized',
  
  -- Autorização do usuário (obrigatória)
  user_authorization BOOLEAN NOT NULL DEFAULT true,
  
  -- Motivo da autorização (opcional)
  authorization_reason TEXT,
  
  -- Timestamps
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadata (opcional, para auditoria)
  metadata JSONB DEFAULT '{}'
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_payment_authorization_tenant_event
  ON event_payment_authorization (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_payment_authorization_tenant_status
  ON event_payment_authorization (tenant_id, status)
  WHERE status = 'authorized';

CREATE INDEX IF NOT EXISTS idx_event_payment_authorization_tenant_custody
  ON event_payment_authorization (tenant_id, custody_id);

CREATE INDEX IF NOT EXISTS idx_event_payment_authorization_authorized_at
  ON event_payment_authorization (tenant_id, authorized_at DESC);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE event_payment_authorization ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'event_payment_authorization'
      AND policyname = 'event_payment_authorization_tenant_isolation'
  ) THEN
    CREATE POLICY event_payment_authorization_tenant_isolation
      ON event_payment_authorization
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trigger_update_event_payment_authorization_updated_at ON event_payment_authorization;
CREATE TRIGGER trigger_update_event_payment_authorization_updated_at
  BEFORE UPDATE ON event_payment_authorization
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE event_payment_authorization IS
  'Autorização de pagamento de eventos (FASE 6.0). Pagamento preparado NÃO é execução.';

COMMENT ON COLUMN event_payment_authorization.custody_id IS
  'ID da custódia relacionada. Pagamento só pode ser autorizado se custódia existe e está ativa.';

COMMENT ON COLUMN event_payment_authorization.split_id IS
  'ID do split declarativo relacionado. Pagamento só pode ser autorizado se split existe e está calculado.';

COMMENT ON COLUMN event_payment_authorization.status IS
  'Status da autorização: authorized (autorizado), revoked (revogado), executed (executado), cancelled (cancelado).';

COMMENT ON COLUMN event_payment_authorization.user_authorization IS
  'Autorização explícita do usuário. Deve ser true para criar autorização.';

COMMENT ON COLUMN event_payment_authorization.authorization_reason IS
  'Motivo da autorização (opcional). Texto livre explicando por que o pagamento foi autorizado.';

-- ============================================================
-- NOTA DE COMPATIBILIDADE
-- ============================================================
-- Esta migration cria estrutura canônica para autorização de pagamento.
-- Nenhuma lógica automática é executada.
-- Estado ≠ verdade.
-- Pagamento preparado NÃO executa.
-- ============================================================

