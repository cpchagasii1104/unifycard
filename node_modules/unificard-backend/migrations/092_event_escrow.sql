-- ============================================================
-- UNIFICARD - MIGRATION 092
-- Event Escrow (Contrato v1.3)
-- ============================================================
--
-- OBJETIVO:
-- Implementar escrow financeiro por evento canônico,
-- suportando bloqueio, liberação, reembolso e penalidades.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena snapshot financeiro do evento
--   • registra transações declarativas do escrow
--   • calcula saldo atual de forma derivada
-- - A APLICAÇÃO:
--   • cria transações de escrow de forma idempotente
--   • executa movimentação real via Ledger / SplitEngine
--   • controla lifecycle do escrow
--
-- DECISÕES IMPORTANTES:
-- - status e transaction_type são campos livres
--   (validados no domínio, não no banco)
-- - current_balance_cents é coluna gerada (fonte derivada)
-- - idempotency_key é global (garantido pela aplicação)
-- - updated_at é controlado pela aplicação
--
-- DEPENDÊNCIAS:
-- - tenants
-- - events (tabela canônica)
--
-- IMPACTO:
-- - Cria infraestrutura financeira crítica
-- - Nenhuma movimentação automática ocorre no banco
-- ============================================================


-- ============================================================
-- ESCROW POR EVENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS event_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES events(id) ON DELETE CASCADE,

  -- Saldos acumulados
  total_collected_cents INTEGER NOT NULL DEFAULT 0,
  total_released_cents INTEGER NOT NULL DEFAULT 0,
  total_refunded_cents INTEGER NOT NULL DEFAULT 0,

  current_balance_cents INTEGER GENERATED ALWAYS AS (
    total_collected_cents
    - total_released_cents
    - total_refunded_cents
  ) STORED,

  -- Status declarativo
  status VARCHAR(20) NOT NULL DEFAULT 'COLLECTING',

  -- Timestamps de lifecycle
  locked_at TIMESTAMPTZ,
  release_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_escrow_unique UNIQUE (event_id)
);


-- ============================================================
-- TRANSAÇÕES DO ESCROW (DECLARATIVAS)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  escrow_id UUID NOT NULL
    REFERENCES event_escrow(id) ON DELETE CASCADE,

  transaction_type VARCHAR(20) NOT NULL,

  amount_cents INTEGER NOT NULL
    CHECK (amount_cents <> 0),

  source_account_id UUID,
  destination_account_id UUID,

  ticket_id UUID,
  participant_id UUID,

  reason VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,

  idempotency_key VARCHAR(255) NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_escrow_event
  ON event_escrow (event_id);

CREATE INDEX IF NOT EXISTS idx_event_escrow_status
  ON event_escrow (status);

CREATE INDEX IF NOT EXISTS idx_event_escrow_tenant
  ON event_escrow (tenant_id);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_escrow
  ON event_escrow_transactions (escrow_id);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_type
  ON event_escrow_transactions (transaction_type);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_idempotency
  ON event_escrow_transactions (idempotency_key);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE event_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_escrow_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_escrow_rls ON event_escrow;
DROP POLICY IF EXISTS event_escrow_transactions_rls ON event_escrow_transactions;

CREATE POLICY event_escrow_rls
  ON event_escrow
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY event_escrow_transactions_rls
  ON event_escrow_transactions
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE event_escrow IS
  'Escrow financeiro por evento canônico. Snapshot de valores, sem execução automática.';

COMMENT ON TABLE event_escrow_transactions IS
  'Transações declarativas do escrow. Movimentação real ocorre via Ledger/SplitEngine.';

COMMENT ON COLUMN event_escrow.current_balance_cents IS
  'Saldo atual calculado automaticamente (collected - released - refunded).';

COMMENT ON COLUMN event_escrow_transactions.idempotency_key IS
  'Chave global de idempotência garantida pela aplicação.';













