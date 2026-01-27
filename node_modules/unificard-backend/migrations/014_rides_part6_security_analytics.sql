/*
Arquivo: 014_rides_part6_security_analytics.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Segurança, compartilhamento e histórico financeiro (Rides)

Objetivo:
- Gerenciar contatos de emergência
- Permitir compartilhamento de corridas
- Registrar disputas
- Persistir histórico de ganhos dos motoristas

Dependências:
- extensão uuid-ossp
- users
- rides_rides
- rides_drivers
- função update_updated_at_column
*/

-- =========================================================
-- EXTENSÕES E DEPENDÊNCIAS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- EMERGENCY CONTACTS
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_emergency_contacts (
  emergency_contact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL,
  user_id              UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  name                 VARCHAR(150) NOT NULL,
  phone                VARCHAR(50) NOT NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, user_id, phone)
);

ALTER TABLE IF EXISTS rides_emergency_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_emergency_contacts'
      AND policyname = 'rides_emergency_contacts_rls'
  ) THEN
    CREATE POLICY rides_emergency_contacts_rls
      ON rides_emergency_contacts
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_emergency_contacts_tenant_user
  ON rides_emergency_contacts (tenant_id, user_id);

-- =========================================================
-- RIDE SHARES (COMPARTILHAMENTO DE ROTA)
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_ride_shares (
  ride_share_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL,
  ride_id        UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,
  shared_with    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, ride_id, shared_with)
);

ALTER TABLE IF EXISTS rides_ride_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_ride_shares'
      AND policyname = 'rides_ride_shares_rls'
  ) THEN
    CREATE POLICY rides_ride_shares_rls
      ON rides_ride_shares
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_ride_shares_tenant_ride
  ON rides_ride_shares (tenant_id, ride_id);

-- =========================================================
-- DISPUTES
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_disputes (
  dispute_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL,
  ride_id        UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  opened_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  status         VARCHAR(40) NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  reason         TEXT,
  resolution     TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, ride_id)
);

ALTER TABLE IF EXISTS rides_disputes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_disputes'
      AND policyname = 'rides_disputes_rls'
  ) THEN
    CREATE POLICY rides_disputes_rls
      ON rides_disputes
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_disputes_updated_at ON rides_disputes;
CREATE TRIGGER trg_rides_disputes_updated_at
  BEFORE UPDATE ON rides_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_rides_disputes_tenant_status
  ON rides_disputes (tenant_id, status);

-- =========================================================
-- DRIVER EARNINGS HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_earnings_history (
  earnings_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL,
  driver_id      UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  ride_id        UUID REFERENCES rides_rides(ride_id) ON DELETE SET NULL,
  amount         NUMERIC(10,2) NOT NULL CHECK (amount >= 0),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS rides_driver_earnings_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_driver_earnings_history'
      AND policyname = 'rides_driver_earnings_history_rls'
  ) THEN
    CREATE POLICY rides_driver_earnings_history_rls
      ON rides_driver_earnings_history
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_driver_earnings_history_tenant_driver
  ON rides_driver_earnings_history (tenant_id, driver_id);

CREATE INDEX IF NOT EXISTS idx_rides_driver_earnings_history_tenant_created
  ON rides_driver_earnings_history (tenant_id, created_at DESC);
