-- ============================================================
-- UNIFICARD — MIGRATION 069
-- Arquivo: 069_event_commerce.sql
-- Tipo: ESTRUTURAL / COMMERCE (ingressos, consumo, estacionamento)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Este módulo implementa commerce para eventos:
-- • ingressos (tickets)
-- • consumo (bar/itens)
-- • estacionamento
--
-- GOVERNANÇA FINANCEIRA (CRÍTICO)
-- • Valores monetários são armazenados em CENTAVOS (INTEGER)
-- • Evita erros de arredondamento e inconsistências de cálculo
--
-- RLS
-- • Isolamento por tenant (tenant_id via app.current_tenant)
-- • Controle fino (ex: usuário só vê o próprio) é feito no serviço
--   (decisão consciente para compatibilidade com operações de staff)
--
-- IDEMPOTÊNCIA
-- • CREATE TABLE IF NOT EXISTS
-- • CREATE INDEX IF NOT EXISTS
-- • Policies e triggers com guards em pg_policies/pg_trigger
--
-- DEPENDÊNCIAS
-- • tenants
-- • events (events.id)
-- • global_users
-- • schedule_slots (slot_id) (opcional)
-- • update_updated_at_column()
-- • extensão pgcrypto (gen_random_uuid)
--
-- OBSERVAÇÕES
-- • transaction_id é UUID sem FK nesta migration para evitar acoplamento
--   com variações do módulo financeiro (UnifyBank/ledger).
--   A aplicação garante integridade referencial.
--
-- ============================================================


-- ============================================================
-- EXTENSÕES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1) EVENT_TICKETS (Ingressos)
-- ============================================================

CREATE TABLE IF NOT EXISTS event_tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  schedule_slot_id UUID
    REFERENCES schedule_slots(slot_id)
    ON DELETE SET NULL,

  -- Dinheiro em centavos
  price_paid_cents INTEGER NOT NULL CHECK (price_paid_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  -- Referência ao módulo financeiro (sem FK aqui)
  transaction_id UUID,

  status TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT event_tickets_status_check
    CHECK (status IN ('ACTIVE','USED','REFUNDED','CANCELLED')),

  qr_code TEXT NOT NULL UNIQUE,
  checked_in_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_tickets_event_user
  ON event_tickets (event_id, global_user_id);

CREATE INDEX IF NOT EXISTS idx_event_tickets_qr
  ON event_tickets (qr_code);

CREATE INDEX IF NOT EXISTS idx_event_tickets_event_status
  ON event_tickets (event_id, status);

-- RLS
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_tickets'
      AND policyname = 'event_tickets_tenant_rls'
  ) THEN
    CREATE POLICY event_tickets_tenant_rls
      ON event_tickets
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_event_tickets_updated_at'
  ) THEN
    CREATE TRIGGER trg_event_tickets_updated_at
      BEFORE UPDATE ON event_tickets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- 2) EVENT_CONSUMPTIONS (Consumo)
-- ============================================================

CREATE TABLE IF NOT EXISTS event_consumptions (
  consumption_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  item_name TEXT,

  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

  -- Dinheiro em centavos
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),

  -- Total gerado (garante consistência)
  total_amount_cents INTEGER GENERATED ALWAYS AS (quantity * unit_price_cents) STORED,

  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  transaction_id UUID,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_consumptions_event_created
  ON event_consumptions (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_consumptions_user_created
  ON event_consumptions (global_user_id, created_at DESC);

-- RLS
ALTER TABLE event_consumptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_consumptions'
      AND policyname = 'event_consumptions_tenant_rls'
  ) THEN
    CREATE POLICY event_consumptions_tenant_rls
      ON event_consumptions
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_event_consumptions_updated_at'
  ) THEN
    CREATE TRIGGER trg_event_consumptions_updated_at
      BEFORE UPDATE ON event_consumptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- 3) EVENT_PARKING (Estacionamento)
-- ============================================================

CREATE TABLE IF NOT EXISTS event_parking (
  parking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  vehicle_plate TEXT,

  entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time TIMESTAMPTZ,

  -- Dinheiro em centavos (opcional; pode ser calculado no serviço)
  hourly_rate_cents INTEGER CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents >= 0),
  total_amount_cents INTEGER CHECK (total_amount_cents IS NULL OR total_amount_cents >= 0),

  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  transaction_id UUID,

  status TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT event_parking_status_check
    CHECK (status IN ('ACTIVE','EXITED','PAID')),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_parking_event_status
  ON event_parking (event_id, status);

CREATE INDEX IF NOT EXISTS idx_event_parking_user_status
  ON event_parking (global_user_id, status);

-- (Opcional/forte, mas seguro) evitar múltiplos estacionamentos ativos do mesmo usuário no mesmo evento
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_parking_active_per_user_event
  ON event_parking (event_id, global_user_id)
  WHERE status = 'ACTIVE';

-- RLS
ALTER TABLE event_parking ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_parking'
      AND policyname = 'event_parking_tenant_rls'
  ) THEN
    CREATE POLICY event_parking_tenant_rls
      ON event_parking
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_event_parking_updated_at'
  ) THEN
    CREATE TRIGGER trg_event_parking_updated_at
      BEFORE UPDATE ON event_parking
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE event_tickets IS
  'Ingressos de eventos (commerce) com QR code e status';

COMMENT ON COLUMN event_tickets.price_paid_cents IS
  'Preço pago em centavos (integer para evitar erro financeiro)';

COMMENT ON TABLE event_consumptions IS
  'Consumos vinculados a eventos (itens/quantidade)';

COMMENT ON COLUMN event_consumptions.total_amount_cents IS
  'Total em centavos (gerado: quantity * unit_price_cents)';

COMMENT ON TABLE event_parking IS
  'Controle de estacionamento em eventos (entrada/saída e cobrança opcional)';


-- ============================================================
-- FIM 069_event_commerce.sql
-- ============================================================













